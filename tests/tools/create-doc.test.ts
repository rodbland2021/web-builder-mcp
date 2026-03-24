import { describe, it, expect } from "vitest";
import { generateProjectDoc } from "../../src/tools/create-doc.js";

describe("generateProjectDoc", () => {
  const minimalInput = {
    businessName: "Sunrise Café",
    businessType: "service" as const,
    location: "Melbourne, VIC",
    services: "Coffee, pastries, breakfast",
    targetAudience: "Office workers and coffee enthusiasts",
  };

  it("generates a markdown document with required sections", () => {
    const doc = generateProjectDoc(minimalInput);
    expect(doc).toContain("# Sunrise Café");
    expect(doc).toContain("## Overview");
    expect(doc).toContain("## Sitemap");
    expect(doc).toContain("## Design System");
    expect(doc).toContain("## Components");
    expect(doc).toContain("## Content Plan");
    expect(doc).toContain("## Technical Requirements");
    expect(doc).toContain("## Deployment");
  });

  it("includes location in structured data section", () => {
    const doc = generateProjectDoc(minimalInput);
    expect(doc).toContain("Melbourne, VIC");
  });

  it("includes e-commerce components for e-commerce type", () => {
    const doc = generateProjectDoc({
      ...minimalInput,
      businessType: "e-commerce",
    });
    expect(doc).toContain("Shop");
    expect(doc).toContain("Cart");
  });

  it("includes booking component for service type", () => {
    const doc = generateProjectDoc(minimalInput);
    expect(doc).toContain("Contact");
  });

  it("includes colour palette section", () => {
    const doc = generateProjectDoc({
      ...minimalInput,
      brandColours: "#2563eb, #0f172a",
    });
    expect(doc).toContain("#2563eb");
  });

  it("flags missing logo", () => {
    const doc = generateProjectDoc(minimalInput);
    expect(doc).toContain("Logo: TBD");
  });
});
