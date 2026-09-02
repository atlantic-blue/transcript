import { describe, expect, it } from "vitest";
import { line, withoutSecrets } from "./observe.js";

describe("writing a line", () => {
  it("names the event and carries the fields", () => {
    expect(JSON.parse(line("watch_page_read", { video_id: "gyN9lV9QgyA", status: 200 }))).toEqual({
      event: "watch_page_read",
      video_id: "gyN9lV9QgyA",
      status: 200,
    });
  });

  it("writes one line, so one read is one record", () => {
    expect(line("a", { b: "c\nd" })).not.toContain("\n");
  });
});

describe("keeping credentials out of the log", () => {
  // The caption address carries the signature the platform issued, the token minted for this video
  // and whatever else travels in the query. None of it belongs in a log that is kept for a fortnight.
  const signed =
    "https://www.youtube.com/api/timedtext?v=gyN9lV9QgyA&signature=s3cr3t&expire=1756000000&pot=t0ken&fmt=json3";

  it("keeps the host and the path and drops the query", () => {
    expect(withoutSecrets(signed)).toBe("https://www.youtube.com/api/timedtext");
  });

  it("drops the signature, the token and the expiry", () => {
    const written = withoutSecrets(signed);
    expect(written).not.toContain("s3cr3t");
    expect(written).not.toContain("t0ken");
    expect(written).not.toContain("expire");
  });

  it("says so rather than throwing when the address does not parse", () => {
    expect(withoutSecrets("not an address")).toBe("an address that does not parse");
  });
});
