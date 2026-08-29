import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, isVideoId } from "./contract.js";

describe("the video id shape", () => {
  it("accepts the eleven character id the platform uses", () => {
    expect(isVideoId("gyN9lV9QgyA")).toBe(true);
    expect(isVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isVideoId("_-Aa09Zz123")).toBe(true);
  });

  it("refuses anything that is not eleven characters", () => {
    expect(isVideoId("")).toBe(false);
    expect(isVideoId("short")).toBe(false);
    expect(isVideoId("gyN9lV9QgyAA")).toBe(false);
  });

  it("refuses characters the platform never uses", () => {
    expect(isVideoId("gyN9lV9Qgy!")).toBe(false);
    expect(isVideoId("gyN9lV9Qgy ")).toBe(false);
    expect(isVideoId("../../../etc")).toBe(false);
    expect(isVideoId("<script>abc")).toBe(false);
  });

  it("holds the schema version the store writes", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
