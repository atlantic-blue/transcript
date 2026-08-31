import { describe, expect, vi } from "vitest";
import { route, type FunctionUrlEvent } from "../src/handler.js";
import { makeLookup } from "../src/store/lookup.js";
import { MemoryStore } from "../src/store/store.js";
import { fetchTranscript } from "../src/transcript/youtube.js";
import { scenario, theAnswer, type World } from "./scenario.js";

// The deployed page reported a working video as deleted. The platform was refusing the address the
// function reads from, and a refusal, a rate limit and a genuinely missing video all reached the
// reader as one 404 that said "No video with that id".
//
// The page the platform really sent is copied here from the function's own log: HTTP 200, over a
// megabyte, no caption track, and a player response asking the caller to prove it is a person.

const REFUSED_BY_THE_PLATFORM =
  `<html><head><title> - YouTube</title></head><body><script>var ytInitialPlayerResponse = ` +
  `{"playabilityStatus":{"status":"LOGIN_REQUIRED","reason":"Sign in to confirm you’re not a bot"},` +
  `"videoDetails":{"videoId":"gyN9lV9QgyA"}};</script></body></html>`;

const DELETED_BY_ITS_OWNER =
  `<html><head><title> - YouTube</title></head><body><script>var x = ` +
  `{"playabilityStatus":{"status":"ERROR","reason":"Video unavailable"}};</script></body></html>`;

const answering = (body: string, status = 200) => {
  const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
  return { ok: status >= 200 && status < 300, status, text: async () => body, headers } as unknown as Response;
};

function readerAsksFor(videoId: string, platformAnswers: Response): (world: World) => Promise<void> {
  return async (world) => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      const lookup = makeLookup(new MemoryStore(), (id) =>
        fetchTranscript(id, {
          fetch: (async () => platformAnswers) as unknown as typeof fetch,
          minter: async () => ({ mint: async () => "a-token", expiresAt: Date.now() + 60_000 }),
        }),
      );
      const request: FunctionUrlEvent = {
        rawPath: "/videos",
        queryStringParameters: { id: videoId },
        requestContext: { http: { method: "GET", path: "/videos" } },
      };
      world.answer = await route(request, lookup);
      world.log = spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>);
    } finally {
      spy.mockRestore();
    }
  };
}

describe("a refusal is not a missing video", () => {
  scenario("the platform refuses the caller, and the reader is told the truth", ({ given, when, then, and }) => {
    given("the platform asks this page to prove it is a person", () => {
      expect(REFUSED_BY_THE_PLATFORM).toContain("LOGIN_REQUIRED");
    });

    when("a reader opens the page for a video that really exists", readerAsksFor("gyN9lV9QgyA", answering(REFUSED_BY_THE_PLATFORM)));

    then("the page does not say the video is missing", (world) => {
      expect(theAnswer(world).body).not.toContain("No video with that id");
      expect(theAnswer(world).statusCode).not.toBe(404);
    });

    and("the status says the fault is upstream, not with the request", (world) => {
      expect(theAnswer(world).statusCode).toBe(502);
    });

    and("the page says the platform refused this page rather than the video", (world) => {
      expect(theAnswer(world).body).toContain("The platform refused this page, not your video");
      expect(theAnswer(world).body).toContain("Your id is right and the video is fine");
    });

    and("the page offers the video where it can still be watched", (world) => {
      expect(theAnswer(world).body).toContain("https://www.youtube.com/watch?v=gyN9lV9QgyA");
    });

    and("the page does not promise that trying again will work", (world) => {
      expect(theAnswer(world).body).toContain("Trying again will not help");
    });

    and("nothing is held at the edge, so a later visit reaches the platform again", (world) => {
      expect(theAnswer(world).headers["cache-control"]).toBe("no-store");
    });

    and("the log names the cause, so an operator can tell this from a deleted video", (world) => {
      const boundary = world.log.find((entry) => entry.event === "watch_page_unreadable");
      expect(boundary?.cause).toBe("bot_check");
      expect(boundary?.playability).toBe("LOGIN_REQUIRED");
    });

    and("the log carries no credential", (world) => {
      expect(JSON.stringify(world.log)).not.toContain("a-token");
    });
  });

  scenario("a video that really is gone is still reported as gone", ({ given, when, then, and }) => {
    given("the platform says the video is unavailable", () => {
      expect(DELETED_BY_ITS_OWNER).toContain("ERROR");
    });

    when("a reader opens the page for it", readerAsksFor("aaaaaaaaaaa", answering(DELETED_BY_ITS_OWNER)));

    then("the page answers 404", (world) => {
      expect(theAnswer(world).statusCode).toBe(404);
    });

    and("the page says there is no video with that id", (world) => {
      expect(theAnswer(world).body).toContain("No video with that id");
    });

    and("the log calls it a missing video, not a refusal", (world) => {
      expect(world.log.find((entry) => entry.event === "watch_page_unreadable")?.cause).toBe("video_missing");
    });
  });
});
