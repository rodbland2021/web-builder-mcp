import { describe, it, expect } from "vitest";
import { generateResearchReport } from "../../src/tools/research.js";

describe("generateResearchReport", () => {
  it("generates a report with all required sections", () => {
    const result = generateResearchReport({
      industry: "café",
      targetAudience: "coffee enthusiasts, office workers",
    });
    expect(result.industry).toBe("café");
    expect(result.sections).toContain("audiencePainPoints");
    expect(result.sections).toContain("competitorAnalysis");
    expect(result.sections).toContain("contentPriorities");
    expect(result.sections).toContain("seoOpportunities");
    expect(result.sections).toContain("heroImageRecommendations");
  });

  it("includes competitor placeholders when URLs provided", () => {
    const result = generateResearchReport({
      industry: "café",
      competitorUrls: ["https://cafe1.com", "https://cafe2.com"],
    });
    expect(result.competitors).toHaveLength(2);
    expect(result.competitors[0].url).toBe("https://cafe1.com");
  });

  it("includes existing site analysis placeholder when URL provided", () => {
    const result = generateResearchReport({
      industry: "plumber",
      existingSiteUrl: "https://oldsite.com",
    });
    expect(result.existingSite).toBeDefined();
    expect(result.existingSite?.url).toBe("https://oldsite.com");
  });

  it("works with minimal input (industry only)", () => {
    const result = generateResearchReport({ industry: "dentist" });
    expect(result.industry).toBe("dentist");
    expect(result.sections.length).toBe(5);
  });
});
