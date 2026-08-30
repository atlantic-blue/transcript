import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION, type TranscriptItem } from "../contract.js";
import { PlatformRefused, VideoNotFound } from "../transcript/youtube.js";
import { makeLookup } from "./lookup.js";
import { MemoryStore } from "./store.js";

const item = (over: Partial<TranscriptItem> = {}): TranscriptItem => ({
  video_id: "gyN9lV9QgyA",
  schema_version: SCHEMA_VERSION,
  fetched_at: "2026-08-29T12:00:00.000Z",
  title: "A title",
  has_captions: true,
  language_code: "en",
  track_kind: "asr",
  track_name: "English (auto-generated)",
  segments: [{ start_seconds: 0, duration_seconds: 1, text: "hello" }],
  text: "hello",
  source: "a source",
  ...over,
});

describe("looking a video up", () => {
  it("fetches once and stores what it fetched", async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn().mockResolvedValue(item());
    const lookup = makeLookup(store, fetcher);

    const first = await lookup("gyN9lV9QgyA");

    expect(first).toEqual({ kind: "ok", item: item(), cached: false });
    expect(await store.get("gyN9lV9QgyA")).toEqual(item());
  });

  it("a second visit to the same id costs no fetch", async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn().mockResolvedValue(item());
    const lookup = makeLookup(store, fetcher);

    await lookup("gyN9lV9QgyA");
    const second = await lookup("gyN9lV9QgyA");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ kind: "ok", item: item(), cached: true });
  });

  it("stores a video with no captions too, so a second visit costs no fetch either", async () => {
    const store = new MemoryStore();
    const silent = item({ has_captions: false, text: "", segments: [], language_code: "", track_kind: "" });
    const fetcher = vi.fn().mockResolvedValue(silent);
    const lookup = makeLookup(store, fetcher);

    await lookup("gyN9lV9QgyA");
    const second = await lookup("gyN9lV9QgyA");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ kind: "ok", item: silent, cached: true });
  });

  it("refuses a malformed id without touching the store or the platform", async () => {
    const store = new MemoryStore();
    const get = vi.spyOn(store, "get");
    const fetcher = vi.fn();
    const lookup = makeLookup(store, fetcher);

    expect(await lookup("nope")).toEqual({ kind: "bad_id", given: "nope" });
    expect(await lookup("")).toEqual({ kind: "bad_id", given: "" });
    expect(await lookup("<script>abc")).toEqual({ kind: "bad_id", given: "<script>abc" });
    expect(get).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("says not found when the platform has no such video", async () => {
    const lookup = makeLookup(new MemoryStore(), () => Promise.reject(new VideoNotFound("gone")));
    expect(await lookup("aaaaaaaaaaa")).toEqual({ kind: "not_found", video_id: "aaaaaaaaaaa" });
  });

  it("says the platform refused, carrying the reason", async () => {
    const lookup = makeLookup(
      new MemoryStore(),
      () => Promise.reject(new PlatformRefused("the caption endpoint returned an empty body")),
    );
    expect(await lookup("gyN9lV9QgyA")).toEqual({
      kind: "upstream_failed",
      video_id: "gyN9lV9QgyA",
      reason: "the caption endpoint returned an empty body",
    });
  });

  it("treats any other failure as the platform refusing rather than crashing", async () => {
    const lookup = makeLookup(new MemoryStore(), () => Promise.reject(new Error("socket closed")));
    expect(await lookup("gyN9lV9QgyA")).toEqual({
      kind: "upstream_failed",
      video_id: "gyN9lV9QgyA",
      reason: "socket closed",
    });
  });

  it("stores nothing when the fetch failed, so the next visit tries again", async () => {
    const store = new MemoryStore();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new PlatformRefused("refused"))
      .mockResolvedValueOnce(item());
    const lookup = makeLookup(store, fetcher);

    expect((await lookup("gyN9lV9QgyA")).kind).toBe("upstream_failed");
    expect((await lookup("gyN9lV9QgyA")).kind).toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
