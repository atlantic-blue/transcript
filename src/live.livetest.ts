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

// What the deployed function is served at a datacentre address: a watch page carrying the bot
// check. Nothing else is faked, so the player endpoint and the caption address are the real ones.
// This is the check that the deploy gate was failing on.
describe("against the real platform, with the watch page refused", () => {
  const BOT_CHECK =
    `<html><title>YouTube</title><script>var x = {"playabilityStatus":{"status":"LOGIN_REQUIRED",` +
    `"reason":"Sign in to confirm you are not a bot"}};</script></html>`;

  it("still reaches the text through the player endpoint", { timeout: 120_000 }, async () => {
    const real = globalThis.fetch;
    const refused = (async (url: string | URL | Request, options?: RequestInit) => {
      if (String(url).includes("/watch?v=")) {
        return new Response(BOT_CHECK, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return real(url, options);
    }) as unknown as typeof fetch;

    const item = await fetchTranscript("gyN9lV9QgyA", { fetch: refused });

    console.log(
      `refused watch page  captions=${item.has_captions}  segments=${item.segments.length}` +
        `  chars=${item.text.length}  source=${item.source}`,
    );
    expect(item.has_captions).toBe(true);
    expect(item.segments.length).toBeGreaterThan(100);
    expect(item.title.length).toBeGreaterThan(0);
  });
});
