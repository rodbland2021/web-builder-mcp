import { describe, it, expect } from "vitest";
import { lighthouseAudit } from "../../src/tools/lighthouse.js";

describe("lighthouseAudit (stub)", () => {
  it("returns stub status", () => {
    const result = lighthouseAudit({ url: "https://example.com" });
    expect(result.status).toBe("stub");
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("includes the target URL in the response", () => {
    const result = lighthouseAudit({ url: "https://mysite.com.au" });
    expect(result.url).toBe("https://mysite.com.au");
  });
});
