import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type LookupResult, type TranscriptItem } from "./contract.js";
import { cacheControlFor, route, type FunctionUrlEvent } from "./handler.js";
import { makeLookup } from "./store/lookup.js";
import { MemoryStore } from "./store/store.js";

const item = (over: Partial<TranscriptItem> = {}): TranscriptItem => ({
  video_id: "gyN9lV9QgyA",
  schema_version: SCHEMA_VERSION,
  fetched_at: "2026-08-29T12:00:00.000Z",
  title: "A title",
  has_captions: true,
  language_code: "en",
  track_kind: "asr",
  track_name: "English (auto-generated)",
  segments: [{ start_seconds: 0, duration_seconds: 1, text: "the words" }],
  text: "the words",
  source: "a source",
  ...over,
});

const get = (path: string, id?: string): FunctionUrlEvent => ({
  rawPath: path,
  queryStringParameters: id === undefined ? {} : { id },
  requestContext: { http: { method: "GET", path } },
});

const always = (result: LookupResult) => async () => result;

describe("routing", () => {
  it("serves the front page at the root", async () => {
    const answer = await route(get("/"), always({ kind: "bad_id", given: "" }));
    expect(answer.statusCode).toBe(200);
    expect(answer.body).toContain("Read a video as text");
  });

  it("serves the transcript at /videos with an id", async () => {
    const answer = await route(get("/videos", "gyN9lV9QgyA"), always({ kind: "ok", item: item(), cached: false }));
    expect(answer.statusCode).toBe(200);
    expect(answer.body).toContain("the words");
    expect(answer.headers["content-type"]).toBe("text/html; charset=utf-8");
  });

  it("treats /videos with no id as a malformed id rather than crashing", async () => {
    const lookup = vi.fn().mockResolvedValue({ kind: "bad_id", given: "" });
    const answer = await route(get("/videos"), lookup);
    expect(lookup).toHaveBeenCalledWith("");
    expect(answer.statusCode).toBe(400);
  });

  it("answers 404 for an address it does not serve", async () => {
    const answer = await route(get("/nothing"), always({ kind: "bad_id", given: "" }));
    expect(answer.statusCode).toBe(404);
    expect(answer.body).toContain("There is nothing here");
  });

  it("refuses a method that is not a read", async () => {
    const answer = await route(
      { rawPath: "/videos", requestContext: { http: { method: "POST", path: "/videos" } } },
      always({ kind: "bad_id", given: "" }),
    );
    expect(answer.statusCode).toBe(404);
    expect(answer.headers["cache-control"]).toBe("no-store");
  });

  it("carries headers that stop the browser guessing at the content", async () => {
    const answer = await route(get("/"), always({ kind: "bad_id", given: "" }));
    expect(answer.headers["x-content-type-options"]).toBe("nosniff");
    expect(answer.headers["content-security-policy"]).toContain("default-src 'none'");
  });
});

describe("what the edge is told to hold", () => {
  it("holds a good answer at the edge for a day", () => {
    expect(cacheControlFor({ kind: "ok", item: item(), cached: false })).toBe(
      "public, max-age=300, s-maxage=86400",
    );
  });

  it("holds a missing video only briefly", () => {
    expect(cacheControlFor({ kind: "not_found", video_id: "aaaaaaaaaaa" })).toContain("s-maxage=300");
    expect(cacheControlFor({ kind: "bad_id", given: "x" })).toContain("s-maxage=300");
  });

  it("never holds a failure, so the next visit reaches the platform", () => {
    expect(cacheControlFor({ kind: "upstream_failed", video_id: "x", cause: "bot_check", reason: "r" })).toBe("no-store");
  });
});

describe("a second visit to the same id", () => {
  it("costs no fetch, and the reader cannot tell the difference", async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn().mockResolvedValue(item());
    const lookup = makeLookup(store, fetcher);

    const first = await route(get("/videos", "gyN9lV9QgyA"), lookup);
    const second = await route(get("/videos", "gyN9lV9QgyA"), lookup);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
  });

  it("costs no fetch for a video with no captions either", async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn().mockResolvedValue(item({ has_captions: false, text: "", segments: [] }));
    const lookup = makeLookup(store, fetcher);

    await route(get("/videos", "gyN9lV9QgyA"), lookup);
    const second = await route(get("/videos", "gyN9lV9QgyA"), lookup);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.body).toContain("This video has no captions");
  });
});
