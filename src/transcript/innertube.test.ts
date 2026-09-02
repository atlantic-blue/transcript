import { describe, expect, it, vi } from "vitest";
import { readThroughPlayer } from "./innertube.js";

// Real headers rather than an object with the one method the code happens to call. A double that
// answers less than the real thing turns a missing call into a green test.
const jsonOf = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ "content-type": "application/json" }),
  }) as unknown as Response;

const textOf = (body: string, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
    headers: new Headers({ "content-type": "application/json" }),
  }) as unknown as Response;

const playable = (withTrack = true) => ({
  playabilityStatus: { status: "OK" },
  videoDetails: { title: "A title" },
  captions: withTrack
    ? {
        playerCaptionsTracklistRenderer: {
          captionTracks: [
            {
              baseUrl: "https://www.youtube.com/api/timedtext?v=x&signature=secret",
              name: { simpleText: "English (auto-generated)" },
              languageCode: "en",
              kind: "asr",
            },
          ],
        },
      }
    : {},
});

const captionBody = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "first" }, { utf8: " line" }] },
    { tStartMs: 1500, dDurationMs: 2000, segs: [{ utf8: "second line" }] },
  ],
});

describe("reading through the player endpoint", () => {
  it("returns the title, the track and the lines when the video plays", async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonOf(playable())).mockResolvedValueOnce(textOf(captionBody));

    const read = await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch);

    expect(read?.title).toBe("A title");
    expect(read?.track?.languageCode).toBe("en");
    expect(read?.track?.kind).toBe("asr");
    expect(read?.segments).toHaveLength(2);
    expect(read?.segments.map((s) => s.text).join(" ")).toBe("first line second line");
  });

  // The whole reason this path exists: it must not carry the proof of origin token the watch page
  // path needs, because minting one is what the refused address cannot do.
  it("asks as the phone client, and asks for the captions with no proof of origin token", async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonOf(playable())).mockResolvedValueOnce(textOf(captionBody));

    await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch);

    const [playerUrl, playerOptions] = f.mock.calls[0] as [string, RequestInit];
    expect(playerUrl).toContain("/youtubei/v1/player");
    expect(playerOptions.method).toBe("POST");
    const sent = JSON.parse(playerOptions.body as string) as {
      videoId: string;
      context: { client: { clientName: string } };
    };
    expect(sent.videoId).toBe("gyN9lV9QgyA");
    expect(sent.context.client.clientName).toBe("IOS");

    const [captionUrl] = f.mock.calls[1] as [string];
    expect(captionUrl).toContain("fmt=json3");
    expect(captionUrl).not.toContain("pot=");
  });

  it("returns a read with no captions when the video plays and carries no track", async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonOf(playable(false)));

    const read = await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch);

    expect(read).not.toBeNull();
    expect(read?.track).toBeNull();
    expect(read?.segments).toEqual([]);
    expect(read?.title).toBe("A title");
    expect(f).toHaveBeenCalledTimes(1);
  });

  // Everything below returns null rather than a reason. This path is a second opinion, so when it
  // has nothing to add the caller reports what the watch page said.
  it("returns null when the video does not play", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonOf({ playabilityStatus: { status: "ERROR", reason: "This video is unavailable" } }));

    expect(await readThroughPlayer("aaaaaaaaaaa", f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the player endpoint answers with a status", async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonOf({}, 429));
    expect(await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the player endpoint cannot be reached", async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error("no route to host"));
    expect(await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the caption address answers with a status", async () => {
    const f = vi.fn().mockResolvedValueOnce(jsonOf(playable())).mockResolvedValueOnce(textOf("", 403));
    expect(await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when the caption address answers with something that is not json", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonOf(playable()))
      .mockResolvedValueOnce(textOf("<?xml version=\"1.0\"?><timedtext/>"));
    expect(await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch)).toBeNull();
  });

  it("returns null when every line of the track is empty", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonOf(playable()))
      .mockResolvedValueOnce(textOf(JSON.stringify({ events: [{ tStartMs: 0, segs: [{ utf8: " " }] }] })));
    expect(await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch)).toBeNull();
  });

  // The caption address is signed. Writing it whole puts the signature in the log.
  it("never writes the signature on the caption address to the log", async () => {
    const written: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line: string) => void written.push(line));
    const f = vi.fn().mockResolvedValueOnce(jsonOf(playable())).mockResolvedValueOnce(textOf("", 403));

    await readThroughPlayer("gyN9lV9QgyA", f as unknown as typeof fetch);
    log.mockRestore();

    expect(written.join("\n")).not.toContain("secret");
    expect(written.join("\n")).toContain("https://www.youtube.com/api/timedtext");
  });
});
