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

const minter = { mint: async () => "a-token", expiresAt: Date.now() + 60_000 };
const getMinter = async () => minter;

const responseOf = (body: string, status = 200, cookies: string[] = []) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: { getSetCookie: () => cookies },
  }) as unknown as Response;

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

  it("says the video does not exist when the watch page carries no video", async () => {
    const f = vi.fn().mockResolvedValueOnce(responseOf("<html>Video unavailable</html>"));
    await expect(
      fetchTranscript("aaaaaaaaaaa", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toBeInstanceOf(VideoNotFound);
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
    ).rejects.toThrow(/not json/);
  });

  it("says the platform refused when every event is empty", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(responseOf(watchPage("A title")))
      .mockResolvedValueOnce(responseOf(JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: " " }] }] })));
    await expect(
      fetchTranscript("gyN9lV9QgyA", { fetch: f as unknown as typeof fetch, minter: getMinter }),
    ).rejects.toThrow(/no usable segments/);
  });
});
