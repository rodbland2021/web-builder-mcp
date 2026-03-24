import { describe, it, expect } from "vitest";
import { generateDiscoveryQuestions } from "../../src/tools/discover.js";

describe("generateDiscoveryQuestions", () => {
  it("generates questions for a service business", () => {
    const result = generateDiscoveryQuestions({
      businessType: "service",
      businessName: "Sunrise Café",
      location: "Melbourne, VIC",
    });
    expect(result.questions).toBeInstanceOf(Array);
    expect(result.questions.length).toBeGreaterThan(3);
    expect(result.businessType).toBe("service");
  });

  it("generates different questions for e-commerce", () => {
    const result = generateDiscoveryQuestions({
      businessType: "e-commerce",
      businessName: "Pet Supplies Co",
      location: "Sydney, NSW",
    });
    expect(result.questions.some((q: string) => q.toLowerCase().includes("product"))).toBe(true);
  });

  it("flags missing logo when not provided", () => {
    const result = generateDiscoveryQuestions({
      businessType: "service",
      businessName: "Test Biz",
      location: "Brisbane",
    });
    expect(result.flaggedAssets).toContain("logo creation needed");
  });

  it("does not flag logo when provided", () => {
    const result = generateDiscoveryQuestions({
      businessType: "service",
      businessName: "Test Biz",
      location: "Brisbane",
      logoUrl: "https://example.com/logo.png",
    });
    expect(result.flaggedAssets).not.toContain("logo creation needed");
  });
});
