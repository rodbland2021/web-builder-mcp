import { describe, it, expect } from "vitest";
import { generateStyles, generateSiteJs, generateHtmlPage } from "../../src/tools/templates.js";

describe("templates", () => {
  describe("generateStyles", () => {
    it("includes CSS custom properties in :root", () => {
      const css = generateStyles({ primaryColor: "#2563eb", fontFamily: "Inter" });
      expect(css).toContain(":root");
      expect(css).toContain("--color-primary: #2563eb");
      expect(css).toContain("--font-family: Inter");
    });

    it("includes skip-link styles", () => {
      const css = generateStyles({});
      expect(css).toContain(".skip-link");
    });

    it("includes focus-visible styles", () => {
      const css = generateStyles({});
      expect(css).toContain(":focus-visible");
    });

    it("includes mobile-first media queries", () => {
      const css = generateStyles({});
      expect(css).toContain("min-width: 768px");
    });
  });

  describe("generateSiteJs", () => {
    it("includes mobile nav toggle", () => {
      const js = generateSiteJs();
      expect(js).toContain("nav-toggle");
    });

    it("includes escape key handler", () => {
      const js = generateSiteJs();
      expect(js).toContain("Escape");
    });
  });

  describe("generateHtmlPage", () => {
    it("includes skip-to-content link", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "<p>Hello</p>" });
      expect(html).toContain('class="skip-link"');
      expect(html).toContain('href="#main"');
    });

    it("includes semantic landmarks", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "" });
      expect(html).toContain("<header");
      expect(html).toContain("<main");
      expect(html).toContain("<footer");
    });

    it("includes lang attribute", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "", lang: "en-AU" });
      expect(html).toContain('lang="en-AU"');
    });

    it("includes meta viewport", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "" });
      expect(html).toContain("viewport");
    });
  });
});
