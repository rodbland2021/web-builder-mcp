/**
 * Integration test — the product contract.
 *
 * Generates a site with buildSite(), then runs every quality gate
 * (reviewSite, seoAudit, adaCheck) and asserts they all pass.
 * Then adds shop, booking, and contact pages and re-validates.
 *
 * If this test fails, the product is broken.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildSite } from "../src/tools/build-site.js";
import { reviewSite } from "../src/tools/review-site.js";
import { seoAudit } from "../src/tools/seo-audit.js";
import { adaCheck } from "../src/tools/ada-check.js";
import { addShop } from "../src/tools/add-shop.js";
import { addBooking } from "../src/tools/add-booking.js";
import { addContact } from "../src/tools/add-contact.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Integration: generated sites pass all quality gates", () => {
  let siteDir: string;

  beforeAll(() => {
    siteDir = join(tmpdir(), `wbm-integration-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("buildSite generates a site that passes reviewSite", () => {
    buildSite({
      businessName: "Test Co",
      businessType: "service",
      location: "Sydney, NSW",
      outputDir: siteDir,
      tagline: "Quality service in Sydney",
    });

    const review = reviewSite(siteDir);
    const failed = review.checks.filter((c) => !c.passed);
    expect(failed).toEqual([]);
    expect(review.passed).toBe(true);
  });

  it("buildSite generates a site that passes seoAudit", () => {
    const seo = seoAudit(siteDir);
    const failed = seo.checks.filter((c) => !c.passed);
    expect(failed).toEqual([]);
    expect(seo.passed).toBe(true);
  });

  it("buildSite generates a site that passes adaCheck", () => {
    const ada = adaCheck(siteDir);
    expect(ada.violations).toEqual([]);
    expect(ada.passed).toBe(true);
  });

  it("addShop then all checks still pass", () => {
    addShop({
      siteDir,
      products: [
        { name: "Widget A", price: 19.99, description: "A quality widget" },
        { name: "Widget B", price: 29.99, description: "A premium widget" },
      ],
      currency: "USD",
    });

    const review = reviewSite(siteDir);
    const reviewFailed = review.checks.filter((c) => !c.passed);
    expect(reviewFailed).toEqual([]);
    expect(review.passed).toBe(true);

    const seo = seoAudit(siteDir);
    const seoFailed = seo.checks.filter((c) => !c.passed);
    expect(seoFailed).toEqual([]);
    expect(seo.passed).toBe(true);

    const ada = adaCheck(siteDir);
    expect(ada.violations).toEqual([]);
    expect(ada.passed).toBe(true);
  });

  it("addBooking then all checks still pass", () => {
    addBooking({
      siteDir,
      services: ["Consultation", "Follow-up"],
      businessName: "Test Co",
    });

    const review = reviewSite(siteDir);
    const reviewFailed = review.checks.filter((c) => !c.passed);
    expect(reviewFailed).toEqual([]);
    expect(review.passed).toBe(true);

    const seo = seoAudit(siteDir);
    const seoFailed = seo.checks.filter((c) => !c.passed);
    expect(seoFailed).toEqual([]);
    expect(seo.passed).toBe(true);

    const ada = adaCheck(siteDir);
    expect(ada.violations).toEqual([]);
    expect(ada.passed).toBe(true);
  });

  it("addContact then all checks still pass", () => {
    addContact({
      siteDir,
      businessName: "Test Co",
      email: "test@example.com",
    });

    const review = reviewSite(siteDir);
    const reviewFailed = review.checks.filter((c) => !c.passed);
    expect(reviewFailed).toEqual([]);
    expect(review.passed).toBe(true);

    const seo = seoAudit(siteDir);
    const seoFailed = seo.checks.filter((c) => !c.passed);
    expect(seoFailed).toEqual([]);
    expect(seo.passed).toBe(true);

    const ada = adaCheck(siteDir);
    expect(ada.violations).toEqual([]);
    expect(ada.passed).toBe(true);
  });
});
