import { describe, expect, it, vi } from "vitest";
import {
  PlatformRefused,
  VideoNotFound,
  chooseTrack,
  eventsToSegments,
  fetchTranscript,
  readCaptionTracks,
  readTitle,
  trackName,
} from "./youtube.js";

const TRACK_JSON =
  '"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=x\\u0026sig=1","name":{"simpleText":"English (auto-generated)"},"languageCode":"en","kind":"asr"}]';

const watchPage = (title: string, withTracks = true) =>
  `<html><script>var x = {"videoDetails":{"videoId":"gyN9lV9QgyA","title":"${title}","lengthSeconds":"100"}` +
  (withTracks ? `,${TRACK_JSON}` : "") +
  `};</script></html>`;

// What the platform really sends when there is no video: a watch page carrying a player response
// that says so. A bare page with the words on it is not what a missing video looks like.
const missingVideoPage =
  `<html><title>YouTube</title><script>var x = {"playabilityStatus":{"status":"ERROR","reason":"Video unavailable"}};</script></html>`;

const botCheckPage =
  `<html><title>YouTube</title><script>var x = {"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in to confirm you are not a bot"}};</script></html>`;

const minter = { mint: async () => "a-token", expiresAt: Date.now() + 60_000 };
const getMinter = async () => minter;

// Real headers rather than an object with the one method the code happens to call. A double that
// answers less than the real thing turns a missing call into a green test.
const responseOf = (body: string, status = 200, cookies: string[] = [], contentType = "text/html") => {
  const headers = new Headers({ "content-type": contentType });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers,
  } as unknown as Response;
};

const captionBody = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "first" }, { utf8: " line" }] },
    { tStartMs: 1500, dDurationMs: 2000, segs: [{ utf8: "second line" }] },
    { tStartMs: 3500, dDurationMs: 10, segs: [{ utf8: "\n" }] },
  ],
});

describe("reading the watch page", () => {
  it("finds the title", () => {
    expect(readTitle(watchPage("A plain title"))).toBe("A plain title");
  });

  it("unescapes a title the platform escaped", () => {
    expect(readTitle(watchPage("Tea \\u0026 cake"))).toBe("Tea & cake");
  });

  it("returns null when there is no video, which is how a missing video reads", () => {
    expect(readTitle("<html>Video unavailable</html>")).toBeNull();
  });

  it("finds the caption tracks and unescapes the ampersand in the signed address", () => {
    const tracks = readCaptionTracks(watchPage("t"));
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.baseUrl).toContain("&sig=1");
  });

  it("returns no tracks for a page that carries none", () => {
    expect(readCaptionTracks(watchPage("t", false))).toEqual([]);
  });

  it("returns no tracks rather than throwing when the array is malformed", () => {
    expect(readCaptionTracks('"captionTracks":[{not json}]')).toEqual([]);
  });
});

describe("choosing a track", () => {
  it("prefers a track a person wrote over one a machine generated", () => {
    const chosen = chooseTrack([
      { baseUrl: "a", kind: "asr", languageCode: "en" },
      { baseUrl: "b", languageCode: "de" },
    ]);
    expect(chosen?.baseUrl).toBe("b");
  });

  it("prefers English when both tracks are the same kind", () => {
    const chosen = chooseTrack([
      { baseUrl: "a", languageCode: "de" },
      { baseUrl: "b", languageCode: "en" },
    ]);
    expect(chosen?.baseUrl).toBe("b");
  });

  it("returns nothing when there are no tracks", () => {
    expect(chooseTrack([])).toBeNull();
  });

  it("reads a name given as runs as well as one given plainly", () => {
    expect(trackName({ baseUrl: "a", name: { runs: [{ text: "English" }] } })).toBe("English");
    expect(trackName({ baseUrl: "a" })).toBe("");
  });
});

describe("turning caption events into segments", () => {
  it("converts milliseconds to seconds and joins the pieces of one line", () => {
    const segments = eventsToSegments([
      { tStartMs: 1234, dDurationMs: 5678, segs: [{ utf8: "a" }, { utf8: "b" }] },
    ]);
    expect(segments).toEqual([{ start_seconds: 1.23, duration_seconds: 5.68, text: "ab" }]);
  });

  it("drops an event that carries only whitespace", () => {
    expect(eventsToSegments([{ tStartMs: 0, segs: [{ utf8: "\n" }] }])).toEqual([]);
  });

  it("treats a missing start or duration as zero", () => {
    expect(eventsToSegments([{ segs: [{ utf8: "x" }] }])).toEqual([
      { start_seconds: 0, duration_seconds: 0, text: "x" },
    ]);
  });
});

describe("fetching a transcript", () => {
  it("returns the item with its text when the platform answers", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title"), 200, ["VISITOR=1; Path=/"]))
      .mockResolvedValueOnce(responseOf(captionBody));

    const item = await fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter });

    expect(item.has_captions).toBe(true);
    expect(item.title).toBe("A title");
    expect(item.track_kind).toBe("asr");
    expect(item.language_code).toBe("en");
    expect(item.segments).toHaveLength(2);
    expect(item.text).toBe("first line second line");
    expect(item.schema_version).toBe(1);
    expect(item.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("sends the proof of origin token bound to the video id, and the cookies from the watch page", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title"), 200, ["VISITOR=1; Path=/"]))
      .mockResolvedValueOnce(responseOf(captionBody));

    await fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter });

    const [url, options] = f.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("pot=a-token");
    expect(url).toContain("fmt=json3");
    expect(url).toContain("c=WEB");
    expect((options.headers as Record<string, string>).cookie).toBe("VISITOR=1");
  });

  it("mints the token against the video id, never against the visitor identity", async () => {
    const mint = vi.fn().mockResolvedValue("a-token");
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title")))
      .mockResolvedValueOnce(responseOf(captionBody));

    await fetchTranscript("gyN9lV9QgyA", {
      fetch: f as unknown as typeof fetch,
      minter: async () => ({ mint, expiresAt: Date.now() + 1000 }),
    });

    expect(mint).toHaveBeenCalledWith("gyN9lV9QgyA");
  });

  it("returns an item saying there are no captions, and does not ask for any", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf(watchPage("Silent", false)));

    const item = await fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter });

    expect(item.has_captions).toBe(false);
    expect(item.title).toBe("Silent");
    expect(item.text).toBe("");
    expect(item.segments).toEqual([]);
    expect(item.language_code).toBe("");
    expect(item.track_kind).toBe("");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("says the video does not exist when the platform says the video is unplayable", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf(missingVideoPage));
    await expect(
      fetchTranscript("aaaaaaaaaaa", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toBeInstanceOf(VideoNotFound);
  });

  // This is the defect the page was built on. A page the code does not recognise carries no video
  // and names no reason, which is exactly what a refusal looks like, so calling it a missing video
  // told the reader a working video had been deleted.
  it("does not call a page it cannot recognise a missing video", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf("<html>something else entirely</html>"));
    const failure = await fetchTranscript("gyN9lV9QgyA", {
      fetch: f as unknown as typeof fetch,
      minter: getMinter,
    }).catch((thrown: unknown) => thrown);

    expect(failure).toBeInstanceOf(PlatformRefused);
    expect(failure).not.toBeInstanceOf(VideoNotFound);
    expect((failure as PlatformRefused).why).toBe("unrecognised_page");
  });

  it("says the platform refused, not that the video is missing, when it asks for proof of a person", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf(botCheckPage));
    const failure = await fetchTranscript("gyN9lV9QgyA", {
      fetch: f as unknown as typeof fetch,
      minter: getMinter,
    }).catch((thrown: unknown) => thrown);

    expect(failure).toBeInstanceOf(PlatformRefused);
    expect((failure as PlatformRefused).why).toBe("bot_check");
  });

  it("says the platform refused when the caption body comes back empty", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title")))
      .mockResolvedValueOnce(responseOf(""));
    await expect(
      fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toThrow(/empty body/);
  });

  it("says the platform refused when the watch page answers with a status", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf("", 429));
    await expect(
      fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toBeInstanceOf(PlatformRefused);
  });

  it("says the platform refused when the caption body is not json", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title")))
      .mockResolvedValueOnce(responseOf("<html>no</html>"));
    await expect(
      fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toThrow(/is not json/);
  });

  it("says the platform refused when every event is empty", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title")))
      .mockResolvedValueOnce(responseOf(JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: " " }] }] })));
    await expect(
      fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toThrow(/no usable line/);
  });
});

// The watch page is refused at a datacentre address and readable elsewhere, which is what stopped
// the deployed function. A refusal is now a question asked again, not an answer to the reader.
describe("when the watch page is refused, the player endpoint is asked", () => {
  const playerAnswer = {
      "playabilityStatus": {
          "status": "OK"
      },
      "videoDetails": {
          "title": "A title the player knows"
      },
      "captions": {
          "playerCaptionsTracklistRenderer": {
              "captionTracks": [
                  {
                      "baseUrl": "https://www.youtube.com/api/timedtext?v=x&signature=1",
                      "name": {
                          "simpleText": "English (auto-generated)"
                      },
                      "languageCode": "en",
                      "kind": "asr"
                  }
              ]
          }
      }
  };

  const jsonOf = (body: unknown, status = 200) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
      headers: new Headers({ "content-type": "application/json" }),
    }) as unknown as Response;

  it("returns the transcript the player found instead of the refusal", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(botCheckPage))
      .mockResolvedValueOnce(jsonOf(playerAnswer))
      .mockResolvedValueOnce(responseOf(captionBody, 200, [], "application/json"));

    const item = await fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter });

    expect(item.has_captions).toBe(true);
    expect(item.title).toBe("A title the player knows");
    expect(item.text).toBe("first line second line");
    expect(item.source).toContain("ios client");
  });

  it("still refuses when the player endpoint has nothing to add", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(botCheckPage))
      .mockResolvedValueOnce(jsonOf({ playabilityStatus: { status: "LOGIN_REQUIRED" } }));

    const failure = await fetchTranscript("gyN9lV9QgyA", {
      fetch: f as unknown as typeof fetch,
      minter: getMinter,
    }).catch((thrown: unknown) => thrown);

    expect(failure).toBeInstanceOf(PlatformRefused);
    expect((failure as PlatformRefused).why).toBe("bot_check");
  });

  // A missing video is proved from the watch page, so there is nothing to ask again about.
  it("does not ask the player when the platform proved the video is missing", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf(missingVideoPage));

    await expect(
      fetchTranscript("aaaaaaaaaaa", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toBeInstanceOf(VideoNotFound);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
