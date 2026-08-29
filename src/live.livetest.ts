import { describe, expect, it, vi } from "vitest";
import { route } from "./handler.js";
import { makeLookup } from "./store/lookup.js";
import { MemoryStore } from "./store/store.js";
import { fetchTranscript } from "./transcript/youtube.js";

const get = (id: string) => ({
  rawPath: "/videos",
  queryStringParameters: { id },
  requestContext: { http: { method: "GET", path: "/videos" } },
});

describe("against the real platform", () => {
  it("serves each of the four states, and a second visit costs no fetch", { timeout: 180_000 }, async () => {
    const store = new MemoryStore();
    const fetcher = vi.fn((id: string) => fetchTranscript(id));
    const lookup = makeLookup(store, fetcher);

    for (const [label, id] of [
      ["has captions", "gyN9lV9QgyA"],
      ["no captions", "5qap5aO4i9A"],
      ["does not exist", "aaaaaaaaaaa"],
      ["malformed", "not-an-id"],
    ]) {
      const answer = await route(get(id!), lookup);
      const stored = await store.get(id!);
      console.log(
        `${label!.padEnd(15)} status ${answer.statusCode}  html ${String(answer.body.length).padStart(7)}` +
          `  cache=${answer.headers["cache-control"]}  captions=${stored ? stored.has_captions : "-"}` +
          `  chars=${stored ? stored.text.length : "-"}  segments=${stored ? stored.segments.length : "-"}`,
      );
    }

    const before = fetcher.mock.calls.length;
    const again = await route(get("gyN9lV9QgyA"), lookup);
    console.log(`second visit    status ${again.statusCode}  fetches ${before} -> ${fetcher.mock.calls.length}`);
    expect(fetcher.mock.calls.length).toBe(before);

    const first = await store.get("gyN9lV9QgyA");
    expect(first?.has_captions).toBe(true);
    expect(first?.segments.length).toBeGreaterThan(100);
  });
});
