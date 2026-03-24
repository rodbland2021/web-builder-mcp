import { describe, it, expect } from "vitest";
import { takeScreenshot } from "../../src/tools/screenshot.js";

describe("takeScreenshot (stub)", () => {
  it("returns stub status", () => {
    const result = takeScreenshot({ url: "https://example.com" });
    expect(result.status).toBe("stub");
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("includes viewport dimensions in the response", () => {
    const result = takeScreenshot({ url: "https://example.com", width: 375, height: 812 });
    expect(result.url).toBe("https://example.com");
    expect(result.viewport.width).toBe(375);
    expect(result.viewport.height).toBe(812);
  });
});
