import { describe, it, expect } from "vitest";
import { generateStyles, generateSiteJs, generateHtmlPage } from "../../src/tools/templates.js";
import type { Palette } from "../../src/types.js";

const testPalette: Palette = {
  bg: "#ffffff",
  bgAlt: "#f8fafc",
  text: "#1e293b",
  textMuted: "#64748b",
  primary: "#2563eb",
  primaryDark: "#1e40af",
  accent: "#f59e0b",
  surface: "#ffffff",
  border: "#e2e8f0",
};

describe("templates", () => {
  describe("generateStyles", () => {
    it("includes all 9 palette CSS custom properties", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("--color-bg: #ffffff");
      expect(css).toContain("--color-bg-alt: #f8fafc");
      expect(css).toContain("--color-text: #1e293b");
      expect(css).toContain("--color-text-muted: #64748b");
      expect(css).toContain("--color-primary: #2563eb");
      expect(css).toContain("--color-primary-dark: #1e40af");
      expect(css).toContain("--color-accent: #f59e0b");
      expect(css).toContain("--color-surface: #ffffff");
      expect(css).toContain("--color-border: #e2e8f0");
    });

    it("includes font-family from parameter", () => {
      const css = generateStyles(testPalette, "Roboto, sans-serif");
      expect(css).toContain("--font-family: Roboto, sans-serif");
    });

    it("includes .hero with min-height", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".hero");
      expect(css).toContain("min-height: calc(100vh - var(--nav-height))");
    });

    it("includes .hero-overlay", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".hero-overlay");
      expect(css).toContain("rgba(0,0,0,0.55)");
    });

    it("includes .trust-badges and .trust-badge", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".trust-badges");
      expect(css).toContain(".trust-badge");
      expect(css).toContain("border-radius: 999px");
    });

    it("includes .section-alt using var(--color-bg-alt)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".section-alt");
      expect(css).toContain("var(--color-bg-alt)");
    });

    it("includes .nav-phone", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".nav-phone");
    });

    it("includes .footer-grid", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".footer-grid");
      expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))");
    });

    it("includes hover transitions on cards and buttons", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".feature-card:hover");
      expect(css).toContain("translateY(-4px)");
      expect(css).toContain(".btn:hover");
    });

    it("includes skip-link styles", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".skip-link");
    });

    it("includes focus-visible styles", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(":focus-visible");
    });

    it("includes mobile-first media queries", () => {
      const css = generateStyles(testPalette);
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

    it("renders phone in nav when provided", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        phone: "(03) 9123 4567",
      });
      expect(html).toContain('class="nav-phone"');
      expect(html).toContain("tel:(03)91234567");
      expect(html).toContain("(03) 9123 4567");
    });

    it("renders nav CTA button when provided", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        ctaButton: { text: "Book Now", href: "book.html" },
      });
      expect(html).toContain('class="nav-cta"');
      expect(html).toContain("Book Now");
      expect(html).toContain('href="book.html"');
    });

    it("renders footer content when provided", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        footerContent: '      <div class="footer-grid"><div class="footer-col"><h4>Links</h4></div></div>',
      });
      expect(html).toContain("footer-grid");
      expect(html).toContain("footer-col");
      expect(html).toContain("Links");
    });

    it("renders unsplash attribution when provided", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        unsplashAttribution: "Photo by John on Unsplash",
      });
      expect(html).toContain("Photo by John on Unsplash");
    });
  });
});
