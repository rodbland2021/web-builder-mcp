import { describe, it, expect } from "vitest";
import { reviewProjectDoc } from "../../src/tools/review-doc.js";

describe("reviewProjectDoc", () => {
  const completeDoc = [
    "# Test Business",
    "## Overview",
    "Business name: Test Business",
    "Type: service",
    "Location: Sydney",
    "## Sitemap",
    "- Home",
    "- About",
    "- Contact",
    "## Design System",
    "Primary: #2563eb",
    "## Components",
    "- Contact form",
    "## Content Plan",
    "Homepage: hero, services, testimonials",
    "## Technical Requirements",
    "Hosting: Cloudflare Pages",
    "## Deployment",
    "Project: test-business",
  ].join("\n");

  it("returns no issues for a complete document", () => {
    const result = reviewProjectDoc(completeDoc);
    expect(result.issues).toHaveLength(0);
    expect(result.passed).toBe(true);
  });

  it("flags missing Overview section", () => {
    const doc = completeDoc
      .replace("## Overview", "")
      .replace("Business name: Test Business\nType: service\nLocation: Sydney", "");
    const result = reviewProjectDoc(doc);
    expect(result.issues.some((i) => i.description.toLowerCase().includes("overview"))).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("flags missing Sitemap section", () => {
    const doc = completeDoc.replace("## Sitemap\n- Home\n- About\n- Contact", "");
    const result = reviewProjectDoc(doc);
    expect(result.issues.some((i) => i.description.toLowerCase().includes("sitemap"))).toBe(true);
  });

  it("flags missing Design System section", () => {
    const doc = completeDoc.replace("## Design System\nPrimary: #2563eb", "");
    const result = reviewProjectDoc(doc);
    expect(result.issues.some((i) => i.description.toLowerCase().includes("design"))).toBe(true);
  });

  it("returns numbered issues", () => {
    const bareDoc = "# Test Business\nSome content";
    const result = reviewProjectDoc(bareDoc);
    expect(result.issues.length).toBeGreaterThan(0);
    result.issues.forEach((issue, i) => {
      expect(issue.number).toBe(i + 1);
    });
  });
});
