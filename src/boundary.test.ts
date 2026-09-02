import { afterEach, describe, expect, it, vi } from "vitest";
import type { Cause } from "./contract.js";
import { route, type FunctionUrlEvent } from "./handler.js";
import { makeLookup } from "./store/lookup.js";
import { MemoryStore } from "./store/store.js";
import { fetchTranscript } from "./transcript/youtube.js";

// From the boundary to the page, with only the platform faked. Every one of these used to reach the
// reader as the same 404 saying the video does not exist.

const get = (id: string): FunctionUrlEvent => ({
  rawPath: "/videos",
  queryStringParameters: { id },
  requestContext: { http: { method: "GET", path: "/videos" } },
});

const responseOf = (body: string, status = 200, cookies: string[] = []) => {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers } as unknown as Response;
};

// The shape the deployed function really received, copied from its own log: a full watch page,
// HTTP 200, carrying videoDetails but no title, no caption track, and a player response that asks
// the caller to prove it is a person.
const BOT_CHECK_PAGE =
  `<html><head><title> - YouTube</title></head><body><script>var ytInitialPlayerResponse = ` +
  `{"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in to confirm you’re not a bot"},` +
  `"videoDetails":{"videoId":"gyN9lV9QgyA"}};</script></body></html>`;

const MISSING_VIDEO_PAGE =
  `<html><head><title> - YouTube</title></head><body><script>var x = ` +
  `{"playabilityStatus":{"status":"ERROR","reason":"Video unavailable"}};</script></body></html>`;

const GOOD_WATCH_PAGE =
  `<html><head><title>A title - YouTube</title></head><body><script>var x = ` +
  `{"videoDetails":{"videoId":"gyN9lV9QgyA","title":"A title","lengthSeconds":"100"},` +
  `"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=gyN9lV9QgyA\\u0026signature=s3cr3t",` +
  `"name":{"simpleText":"English (auto-generated)"},"languageCode":"en","kind":"asr"}]};</script></body></html>`;

const minter = async () => ({ mint: async () => "a-token", expiresAt: Date.now() + 60_000 });

function pageFor(responses: Response[]) {
  const f = vi.fn();
  for (const response of responses) f.mockResolvedValueOnce(response);
  const lookup = makeLookup(new MemoryStore(), (id) =>
    fetchTranscript(id, { fetch: f as unknown as typeof fetch, minter }),
  );
  return { lookup, f };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what the reader is told, one answer per cause", () => {
  it("a bot check is a refusal, and it never reads as a missing video", async () => {
    const { lookup } = pageFor([responseOf(BOT_CHECK_PAGE)]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(502);
    expect(answer.body).toContain("The platform refused this page, not your video");
    expect(answer.body).toContain("Your id is right and the video is fine");
    expect(answer.body).not.toContain("No video with that id");
    expect(answer.body).not.toContain("may be deleted");
  });

  it("a bot check offers the video on the platform, and does not promise that trying again works", async () => {
    const { lookup } = pageFor([responseOf(BOT_CHECK_PAGE)]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.body).toContain("https://www.youtube.com/watch?v=gyN9lV9QgyA");
    expect(answer.body).toContain("Trying again will not help");
  });

  it("a video that really is missing still answers 404", async () => {
    const { lookup } = pageFor([responseOf(MISSING_VIDEO_PAGE)]);
    const answer = await route(get("aaaaaaaaaaa"), lookup);

    expect(answer.statusCode).toBe(404);
    expect(answer.body).toContain("No video with that id");
  });

  it("a rate limit answers 429 and says when to come back", async () => {
    const { lookup } = pageFor([responseOf("", 429)]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(429);
    expect(answer.headers["retry-after"]).toBe("60");
    expect(answer.body).toContain("asking too often");
  });

  it("a platform error answers 502, not 404", async () => {
    const { lookup } = pageFor([responseOf("", 503)]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(502);
    expect(answer.body).toContain("The platform did not answer");
  });

  it("captions refused after the video was found answers 502 and says the video is fine", async () => {
    const { lookup } = pageFor([responseOf(GOOD_WATCH_PAGE, 200, ["VISITOR=1; Path=/"]), responseOf("")]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(502);
    expect(answer.body).toContain("The platform refused the caption text");
    expect(answer.body).toContain("Your id is right and the video is fine");
  });

  it("a page carrying no video and no reason is a refusal, not a deletion", async () => {
    const { lookup } = pageFor([responseOf("<html>something else entirely</html>")]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(502);
    expect(answer.body).toContain("The platform sent something this page cannot read");
  });

  it("a working video still serves its text, so none of this broke the good path", async () => {
    const captions = JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "the words" }] }],
    });
    const { lookup } = pageFor([
      responseOf(GOOD_WATCH_PAGE, 200, ["VISITOR=1; Path=/"]),
      responseOf(captions),
    ]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);

    expect(answer.statusCode).toBe(200);
    expect(answer.body).toContain("the words");
  });

  it("never holds a refusal at the edge, so the next visit reaches the platform", async () => {
    const { lookup } = pageFor([responseOf(BOT_CHECK_PAGE)]);
    const answer = await route(get("gyN9lV9QgyA"), lookup);
    expect(answer.headers["cache-control"]).toBe("no-store");
  });
});

describe("what the log says while the reader is being told", () => {
  it("names the cause, the status and the shape of the body", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { lookup } = pageFor([responseOf(BOT_CHECK_PAGE)]);
    await route(get("gyN9lV9QgyA"), lookup);

    const lines = spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
    const boundary = lines.find((l) => l.event === "watch_page_unreadable");

    expect(boundary).toBeDefined();
    expect(boundary?.cause satisfies unknown as Cause).toBe("bot_check");
    expect(boundary?.status).toBe(200);
    expect(boundary?.playability).toBe("LOGIN_REQUIRED");
    expect(boundary?.has_caption_tracks).toBe(false);
    expect(String(boundary?.playability_reason)).toContain("not a bot");
  });

  it("writes the cause the page shows, so a log line and a page line up", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { lookup } = pageFor([responseOf(MISSING_VIDEO_PAGE)]);
    await route(get("aaaaaaaaaaa"), lookup);

    const lines = spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
    expect(lines.find((l) => l.event === "watch_page_unreadable")?.cause).toBe("video_missing");
  });

  // The caption address carries a signature and the request carries cookies and a minted token.
  it("never writes a credential, whatever the platform answered", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { lookup } = pageFor([responseOf(GOOD_WATCH_PAGE, 200, ["VISITOR=s3ss10n; Path=/"]), responseOf("")]);
    await route(get("gyN9lV9QgyA"), lookup);

    const everything = spy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(everything).toContain("captions_unreadable");
    expect(everything).not.toContain("s3cr3t");
    expect(everything).not.toContain("s3ss10n");
    expect(everything).not.toContain("a-token");
    expect(everything).not.toContain("signature");
  });

  it("is silent about nothing: a read that worked is written too", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const captions = JSON.stringify({
      events: [{ tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: "the words" }] }],
    });
    const { lookup } = pageFor([responseOf(GOOD_WATCH_PAGE, 200, []), responseOf(captions)]);
    await route(get("gyN9lV9QgyA"), lookup);

    const events = spy.mock.calls.map((call) => (JSON.parse(String(call[0])) as { event: string }).event);
    expect(events).toContain("watch_page_read");
    expect(events).toContain("captions_read");
  });
});
