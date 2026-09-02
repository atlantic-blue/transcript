import { describe, expect, it } from "vitest";
import { WHAT_HAPPENED, causeOf, readShape } from "./diagnosis.js";
import type { Cause } from "../contract.js";

const page = (inner: string, title = "YouTube") =>
  `<html><head><title>${title}</title></head><body><script>var x = {${inner}};</script></body></html>`;

const player = (status: string, reason: string) =>
  `"playabilityStatus":{"status":"${status}","reason":"${reason}"}`;

const causeOfPage = (html: string, status = 200, contentType = "text/html"): Cause =>
  causeOf(readShape(status, contentType, html));

describe("reading the shape of what came back", () => {
  it("records the status, the size and the kind of body", () => {
    const shape = readShape(200, "text/html; charset=utf-8", page(player("ERROR", "Video unavailable")));
    expect(shape.status).toBe(200);
    expect(shape.content_type).toBe("text/html; charset=utf-8");
    expect(shape.bytes).toBeGreaterThan(0);
  });

  it("records what the platform said about playing the video", () => {
    const shape = readShape(200, "text/html", page(player("LOGIN_REQUIRED", "Sign in to confirm")));
    expect(shape.playability).toBe("LOGIN_REQUIRED");
    expect(shape.playability_reason).toBe("Sign in to confirm");
    expect(shape.has_player_response).toBe(true);
  });

  it("records the title of the page, which is what tells a wall apart from a watch page", () => {
    expect(readShape(200, "text/html", page("", "Before you continue")).page_title).toBe("Before you continue");
  });

  it("records whether the video details and the caption tracks are there at all", () => {
    const shape = readShape(200, "text/html", page(`"videoDetails":{},"captionTracks":[]`));
    expect(shape.has_video_details).toBe(true);
    expect(shape.has_caption_tracks).toBe(true);
  });

  it("keeps the page itself out of the record, because a watch page is over a megabyte", () => {
    const shape = readShape(200, "text/html", page(player("ERROR", "Video unavailable")));
    expect(JSON.stringify(shape).length).toBeLessThan(600);
  });
});

describe("naming the cause, one per way a read can fail", () => {
  it("calls a video the platform will not play a missing video", () => {
    expect(causeOfPage(page(player("ERROR", "Video unavailable")))).toBe("video_missing");
    expect(causeOfPage(page(player("UNPLAYABLE", "This video is private")))).toBe("video_missing");
  });

  it("calls a demand for proof of a person a bot check", () => {
    expect(causeOfPage(page("", "Before you continue") + "Sign in to confirm you are not a bot")).toBe("bot_check");
    expect(causeOfPage("Our systems have detected unusual traffic from your computer network")).toBe("bot_check");
    expect(causeOfPage(`<html><script src="https://www.google.com/recaptcha/api.js"></script></html>`)).toBe("bot_check");
    expect(causeOfPage(page(player("LOGIN_REQUIRED", "Sign in")))).toBe("bot_check");
  });

  it("calls a 403 a bot check, because that is what a blocked caller is told", () => {
    expect(causeOfPage("", 403)).toBe("bot_check");
  });

  it("calls a consent page a consent wall when the platform sent no player response", () => {
    expect(causeOfPage(`<html><title>Before you continue to YouTube</title></html>`)).toBe("consent_wall");
  });

  it("calls too many requests a rate limit", () => {
    expect(causeOfPage("", 429)).toBe("rate_limited");
  });

  it("calls a status that is not a page a platform error", () => {
    expect(causeOfPage("", 503)).toBe("platform_error");
    expect(causeOfPage("", 301)).toBe("platform_error");
  });

  // This is the defect that made a working video read as deleted. A page with nothing recognisable
  // in it is a refusal, because that is what the platform sends when it does not want to answer.
  it("calls a page it does not recognise a refusal, never a missing video", () => {
    expect(causeOfPage("<html>something else entirely</html>")).toBe("unrecognised_page");
    expect(causeOfPage("")).toBe("unrecognised_page");
  });

  // A real watch page carries the string consent.youtube.com in its own scripts, so the page for a
  // video that genuinely does not exist matches the consent marker too. The stated verdict wins.
  it("prefers the verdict the platform stated over a word found in the body", () => {
    const both = page(player("ERROR", "Video unavailable")) + "https://consent.youtube.com/";
    expect(causeOfPage(both)).toBe("video_missing");
  });

  it("still calls a caller who is told to prove it is a person a bot check, whatever else is on the page", () => {
    const both = page(player("ERROR", "Video unavailable")) + "Sign in to confirm you are not a bot";
    expect(causeOfPage(both)).toBe("bot_check");
  });
});

describe("what a cause is called in words", () => {
  it("gives every cause a sentence, so no cause reaches a reader unnamed", () => {
    const causes: Cause[] = [
      "video_missing",
      "bot_check",
      "consent_wall",
      "rate_limited",
      "platform_error",
      "unrecognised_page",
      "captions_refused",
      "captions_not_json",
      "captions_empty",
    ];
    for (const cause of causes) {
      expect(WHAT_HAPPENED[cause]).toBeTruthy();
    }
  });
});
