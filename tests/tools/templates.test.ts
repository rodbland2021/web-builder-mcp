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
      expect(css).toContain("min-height: min(75vh, 600px)");
    });

    it("includes .hero-overlay", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".hero-overlay");
      expect(css).toContain("rgba(0,0,0,0.65)");
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
      // S7: feature cards no longer have translateY hover (false affordance)
      expect(css).not.toContain("translateY(-4px)");
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
        footerContent: '      <div class="footer-grid"><div class="footer-col"><p class="footer-col-title">Links</p></div></div>',
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

    // --- S4: Active page indicator ---
    it("marks current page nav link as active with aria-current (S4)", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        navLinks: [
          { href: "index.html", label: "Home" },
          { href: "about.html", label: "About" },
        ],
        currentPage: "about.html",
      });
      expect(html).toContain('href="about.html" class="active" aria-current="page"');
      expect(html).not.toMatch(/href="index.html"[^>]*class="active"/);
    });

    // --- S6: og:image meta tag ---
    it("includes og:image meta tag when ogImage is provided (S6)", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        ogImage: "images/hero.png",
      });
      expect(html).toContain('property="og:image"');
      expect(html).toContain("images/hero.png");
    });

    it("omits og:image when ogImage not provided (S6)", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "" });
      expect(html).not.toContain("og:image");
    });

    // --- P4: LD+JSON via template ---
    it("renders LD+JSON before </body> when ldJson is provided (P4)", () => {
      const ldJson = '{"@context":"https://schema.org","@type":"WebSite"}';
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "<p>Content</p>",
        ldJson,
      });
      const mainEnd = html.indexOf("</main>");
      const ldJsonPos = html.indexOf("application/ld+json");
      expect(ldJsonPos).toBeGreaterThan(mainEnd);
      expect(html).toContain(ldJson);
    });
  });

  describe("generateStyles CSS fixes", () => {
    // --- M6: Form focus ring uses palette colour ---
    it("uses color-mix for form focus ring instead of hardcoded blue (M6)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("color-mix(in srgb, var(--color-primary) 15%, transparent)");
      expect(css).not.toContain("rgba(37,99,235,0.15)");
    });

    // --- S3: Phone visible on mobile ---
    it("does not hide nav-phone on mobile (S3)", () => {
      const css = generateStyles(testPalette);
      // .nav-phone base styles should NOT have display: none
      const navPhoneSection = css.substring(css.indexOf(".nav-phone"), css.indexOf(".nav-phone:hover"));
      expect(navPhoneSection).not.toContain("display: none");
    });

    // --- S7: No translateY hover on feature cards ---
    it("feature-card:hover has no translateY (S7)", () => {
      const css = generateStyles(testPalette);
      const hoverStart = css.indexOf(".feature-card:hover");
      const hoverEnd = css.indexOf("}", hoverStart);
      const hoverBlock = css.substring(hoverStart, hoverEnd);
      expect(hoverBlock).not.toContain("translateY");
    });

    // --- P5: Section title bottom margin ---
    it("section-title uses spacing-xl margin-bottom (P5)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".section-title");
      const sectionTitleStart = css.indexOf(".section-title");
      const sectionTitleEnd = css.indexOf("}", sectionTitleStart);
      const sectionTitleBlock = css.substring(sectionTitleStart, sectionTitleEnd);
      expect(sectionTitleBlock).toContain("var(--spacing-xl)");
    });

    // --- P6: Hamburger touch target ---
    it("nav-toggle has min 44px touch target (P6)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("min-width: 44px");
      expect(css).toContain("min-height: 44px");
    });

    // --- S10: Footer has breathing room ---
    it("footer has increased top padding for breathing room (S10)", () => {
      const css = generateStyles(testPalette);
      const footerStart = css.indexOf(".site-footer {");
      const footerEnd = css.indexOf("}", footerStart);
      const footerBlock = css.substring(footerStart, footerEnd);
      expect(footerBlock).toContain("var(--spacing-3xl)");
    });

    // --- S9: Footer col title CSS resets margin ---
    it("footer-col-title CSS resets margin-top (S9)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("h2.footer-col-title");
      expect(css).toContain("margin-top: 0");
    });

    // --- S4: Active nav link CSS ---
    it("includes .nav-links a.active styles (S4)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".nav-links a.active");
      expect(css).toContain("font-weight: 700");
    });

    // --- M1: Mobile header overflow ---
    it("hides nav-cta on mobile (M1)", () => {
      const css = generateStyles(testPalette);
      // Base .nav-cta should have display: none
      const navCtaStart = css.indexOf(".nav-cta {");
      const navCtaEnd = css.indexOf("}", navCtaStart);
      const navCtaBlock = css.substring(navCtaStart, navCtaEnd);
      expect(navCtaBlock).toContain("display: none");
    });

    it("shows nav-cta on desktop (M1)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".nav-cta { display: inline-flex; }");
    });

    it("nav-logo truncates gracefully on mobile (M1)", () => {
      const css = generateStyles(testPalette);
      const navLogoStart = css.indexOf(".nav-logo {");
      const navLogoEnd = css.indexOf("}", navLogoStart);
      const navLogoBlock = css.substring(navLogoStart, navLogoEnd);
      expect(navLogoBlock).toContain("text-overflow: ellipsis");
      expect(navLogoBlock).toContain("overflow: hidden");
      expect(navLogoBlock).toContain("max-width: 40%");
    });

    it("removes nav-logo max-width on desktop (M1)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".nav-logo { max-width: none; }");
    });

    // --- S5: Footer uses CSS custom properties ---
    it("footer uses CSS custom properties not hardcoded colours (S5)", () => {
      const css = generateStyles(testPalette);
      const footerStart = css.indexOf(".site-footer {");
      const footerEnd = css.indexOf("}", footerStart);
      const footerBlock = css.substring(footerStart, footerEnd);
      expect(footerBlock).toContain("var(--color-footer-bg");
      expect(footerBlock).toContain("var(--color-footer-text");
    });

    it("footer heading uses CSS custom property (S5)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("var(--color-footer-heading");
    });

    // --- S9: prefers-reduced-motion ---
    it("includes prefers-reduced-motion media query (S9)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain("prefers-reduced-motion: reduce");
      expect(css).toContain("scroll-behavior: auto");
    });

    // --- P5: --color-accent is used ---
    it("uses --color-accent for FAQ marker (P5)", () => {
      const css = generateStyles(testPalette);
      const faqAfterStart = css.indexOf(".faq-question::after");
      const faqAfterEnd = css.indexOf("}", faqAfterStart);
      const faqAfterBlock = css.substring(faqAfterStart, faqAfterEnd);
      expect(faqAfterBlock).toContain("var(--color-accent)");
    });

    it("trust badges have no hover state (not clickable)", () => {
      const css = generateStyles(testPalette);
      expect(css).toContain(".trust-badge");
      expect(css).not.toContain(".trust-badge:hover");
    });
  });

  describe("generateHtmlPage og:url and font loading", () => {
    // --- M2: og:url ---
    it("includes og:url meta tag when ogUrl is provided (M2)", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        ogUrl: "https://example.com/index.html",
      });
      expect(html).toContain('property="og:url"');
      expect(html).toContain("https://example.com/index.html");
    });

    it("omits og:url when ogUrl not provided (M2)", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "" });
      expect(html).not.toContain("og:url");
    });

    // --- P6: Google Fonts loading ---
    it("adds Google Fonts link for known font family (P6)", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        fontFamily: "DM Sans, sans-serif",
      });
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain("DM+Sans");
      expect(html).toContain("display=swap");
    });

    it("does not add Google Fonts link for system-ui (P6)", () => {
      const html = generateHtmlPage({
        title: "Test",
        bodyContent: "",
        fontFamily: "system-ui, sans-serif",
      });
      expect(html).not.toContain("fonts.googleapis.com");
    });

    it("does not add Google Fonts link when fontFamily not provided (P6)", () => {
      const html = generateHtmlPage({ title: "Test", bodyContent: "" });
      expect(html).not.toContain("fonts.googleapis.com");
    });
  });
});
