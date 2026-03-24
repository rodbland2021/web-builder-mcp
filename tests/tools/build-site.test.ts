import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSite } from "../../src/tools/build-site.js";
import { createMockProvider } from "../../src/tools/image-generator.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
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

describe("buildSite", () => {
  let outputDir: string;
  const provider = createMockProvider();

  beforeEach(() => {
    outputDir = join(tmpdir(), `wbm-build-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  const minimalInput = {
    businessName: "Sunrise Cafe",
    businessType: "service" as const,
    location: "Melbourne, VIC",
    outputDir: "",
    hero: {
      headline: "Welcome to Sunrise Cafe",
      tagline: "The best coffee in Melbourne",
      cta: { text: "Book a Table", href: "contact.html" },
    },
    palette: testPalette,
  };

  it("creates images/ directory", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "images"))).toBe(true);
  });

  it("creates images/hero.png (SVG from mock)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "images/hero.png"))).toBe(true);
    const content = readFileSync(join(outputDir, "images/hero.png"), "utf-8");
    expect(content).toContain("<svg");
  });

  it("creates index.html with hero section", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("Welcome to Sunrise Cafe");
    expect(html).toContain("hero-overlay");
    expect(html).toContain("hero-content");
    expect(html).toContain("hero-bg");
  });

  it("creates index.html with trust badges when provided", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        trustBadges: ["Licensed", "Insured", "5-Star Rated"],
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("trust-badges");
    expect(html).toContain("trust-badge");
    expect(html).toContain("Licensed");
    expect(html).toContain("Insured");
    expect(html).toContain("5-Star Rated");
  });

  it("creates service cards from input", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        services: [
          { name: "Espresso", description: "Perfect single shot" },
          { name: "Latte Art", description: "Beautiful latte art" },
        ],
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("Espresso");
    expect(html).toContain("Perfect single shot");
    expect(html).toContain("Latte Art");
    expect(html).toContain("feature-card");
    // Service icons should be created
    expect(existsSync(join(outputDir, "images/service-espresso.png"))).toBe(true);
    expect(existsSync(join(outputDir, "images/service-latte-art.png"))).toBe(true);
  });

  it("creates about.html with story content", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        about: {
          story: "Founded in 2010 by coffee lovers",
          mission: "To serve the best coffee",
        },
      },
      { imageProvider: provider }
    );
    expect(existsSync(join(outputDir, "about.html"))).toBe(true);
    const html = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(html).toContain("Founded in 2010 by coffee lovers");
    expect(html).toContain("To serve the best coffee");
    // About image should be created
    expect(existsSync(join(outputDir, "images/about.png"))).toBe(true);
  });

  it("creates contact.html with contact info", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        contactInfo: {
          phone: "(03) 9123 4567",
          email: "hello@sunrise.cafe",
          address: "123 Collins St, Melbourne",
          hours: "Mon-Fri 7am-5pm",
        },
      },
      { imageProvider: provider }
    );
    expect(existsSync(join(outputDir, "contact.html"))).toBe(true);
    const html = readFileSync(join(outputDir, "contact.html"), "utf-8");
    expect(html).toContain("(03) 9123 4567");
    expect(html).toContain("hello@sunrise.cafe");
    expect(html).toContain("123 Collins St, Melbourne");
  });

  it("uses palette colours in CSS", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const css = readFileSync(join(outputDir, "styles.css"), "utf-8");
    expect(css).toContain("--color-primary: #2563eb");
    expect(css).toContain("--color-bg: #ffffff");
    expect(css).toContain("--color-text: #1e293b");
    expect(css).toContain("--color-accent: #f59e0b");
  });

  it("includes LD+JSON with image field", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("application/ld+json");
    // Check the LD+JSON includes image reference (escaped)
    expect(html).toContain("images/hero.png");
  });

  it("returns imagesGenerated and estimatedImageCost", async () => {
    const result = await buildSite(
      {
        ...minimalInput,
        outputDir,
        services: [{ name: "Coffee", description: "Fresh brewed" }],
        about: { story: "Our story" },
      },
      { imageProvider: provider }
    );
    // hero(1) + service(1) + about(1) = 3
    expect(result.imagesGenerated).toBe(3);
    expect(result.estimatedImageCost).toBeDefined();
    expect(result.imageProvider).toBe("mock");
  });

  it("creates styles.css with custom properties", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const css = readFileSync(join(outputDir, "styles.css"), "utf-8");
    expect(css).toContain(":root");
    expect(css).toContain("--color-primary");
  });

  it("creates site.js", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "site.js"))).toBe(true);
  });

  it("creates robots.txt and sitemap.xml", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "robots.txt"))).toBe(true);
    expect(existsSync(join(outputDir, "sitemap.xml"))).toBe(true);
  });

  it("returns list of created files", async () => {
    const result = await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(result.files.length).toBeGreaterThan(3);
    expect(result.files).toContain("index.html");
    expect(result.files).toContain("styles.css");
  });

  it("renders footer with contact info columns", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        contactInfo: {
          phone: "1300 123 456",
          email: "info@test.com",
          hours: "9-5 Mon-Fri",
        },
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("footer-grid");
    expect(html).toContain("footer-col");
  });

  // --- M2: Contact form has submit handler ---
  it("contact.html includes inline form submit handler (M2)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "contact.html"), "utf-8");
    expect(html).toContain("addEventListener('submit'");
    expect(html).toContain("e.preventDefault()");
    expect(html).toContain("contact-error");
    expect(html).toContain("contact-success");
  });

  // --- M3: No premature Shop/Book nav links ---
  it("does not add Shop to nav for hybrid type (M3)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, businessType: "hybrid" as const },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).not.toContain('href="shop.html"');
  });

  it("does not add Shop to nav for e-commerce type (M3)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, businessType: "e-commerce" as const },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).not.toContain('href="shop.html"');
  });

  // --- M4: Custom CTA section ---
  it("uses custom CTA when ctaSection is provided (M4)", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        ctaSection: {
          heading: "Get Started Today",
          text: "Join us for great coffee",
          buttonText: "Sign Up",
          buttonHref: "signup.html",
        },
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("Get Started Today");
    expect(html).toContain("Join us for great coffee");
    expect(html).toContain("Sign Up");
    expect(html).toContain("signup.html");
  });

  it("falls back to hero CTA text when ctaSection is omitted (M4)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    // Should use hero CTA text, not hardcoded "Ready to get started?"
    expect(html).not.toContain("Ready to get started?");
    expect(html).toContain("Book a Table");
  });

  // --- M5: Industry-specific about fallback ---
  it("uses industry-specific fallback for service type (M5)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(html).toContain("proudly serving");
    expect(html).toContain("Melbourne, VIC");
    expect(html).not.toContain("trusted service business based in");
  });

  it("uses industry-specific fallback for e-commerce type (M5)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, businessType: "e-commerce" as const },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(html).toContain("carefully curated products");
  });

  it("uses industry-specific fallback for portfolio type (M5)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, businessType: "portfolio" as const },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(html).toContain("distinctive work");
  });

  // --- S1: Lazy loading on below-fold images ---
  it("adds loading=lazy to service card images (S1)", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        services: [{ name: "Espresso", description: "Perfect shot" }],
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('loading="lazy"');
  });

  // --- S4: Active page indicator ---
  it("marks current page as active in nav (S4)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const indexHtml = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(indexHtml).toContain('class="active" aria-current="page"');
    // index.html should mark Home as active
    expect(indexHtml).toMatch(/href="index.html"[^>]*class="active"/);
    // about.html should mark About as active
    const aboutHtml = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(aboutHtml).toMatch(/href="about.html"[^>]*class="active"/);
  });

  // --- S5: Absolute URLs with siteUrl ---
  it("uses absolute URLs in sitemap when siteUrl is provided (S5)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, siteUrl: "https://sunrise.cafe" },
      { imageProvider: provider }
    );
    const sitemap = readFileSync(join(outputDir, "sitemap.xml"), "utf-8");
    expect(sitemap).toContain("https://sunrise.cafe/index.html");
    expect(sitemap).toContain("https://sunrise.cafe/about.html");
  });

  it("uses absolute canonical URL when siteUrl is provided (S5)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, siteUrl: "https://sunrise.cafe" },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('href="https://sunrise.cafe/index.html"');
  });

  // --- S6: og:image meta tag ---
  it("includes og:image meta tag (S6)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('og:image');
    expect(html).toContain("images/hero.png");
  });

  // --- S8: Favicon ---
  it("creates favicon.svg with primary colour and first letter (S8)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "favicon.svg"))).toBe(true);
    const favicon = readFileSync(join(outputDir, "favicon.svg"), "utf-8");
    expect(favicon).toContain("#2563eb");
    expect(favicon).toContain(">S</text>");
  });

  it("links favicon in HTML head (S8)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('rel="icon" href="favicon.svg"');
  });

  // --- S9/MF-2: Footer column titles use consistent h2 tags ---
  it("uses consistent h2 open and close tags for footer column titles (S9/MF-2)", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        contactInfo: { phone: "123", email: "a@b.com" },
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('<h2 class="footer-col-title">');
    expect(html).not.toContain('<p class="footer-col-title">');
    // No mismatched tags (h2 opening with h3 closing)
    expect(html).not.toMatch(/<h2 class="footer-col-title">[^<]*<\/h3>/);
  });

  // --- P1: LD+JSON url field uses siteUrl ---
  it("LD+JSON includes siteUrl when provided (P1)", async () => {
    await buildSite(
      { ...minimalInput, outputDir, siteUrl: "https://sunrise.cafe" },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain('"url": "https://sunrise.cafe"');
  });

  it("LD+JSON omits url field when siteUrl not provided (P1)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).not.toContain('"url": ""');
  });

  // --- P4: LD+JSON placed before </body> ---
  it("places LD+JSON before </body>, not inside <main> (P4)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    const mainEnd = html.indexOf("</main>");
    const ldJsonPos = html.lastIndexOf("application/ld+json");
    expect(ldJsonPos).toBeGreaterThan(mainEnd);
  });

  // --- MF-2: Footer headings use consistent h2 tags (no h2/h3 mismatch) ---
  it("footer column titles have matching open/close h2 tags (MF-2)", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        contactInfo: { phone: "123", email: "a@b.com", hours: "9-5" },
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    const openH2 = (html.match(/<h2 class="footer-col-title">/g) ?? []).length;
    expect(openH2).toBeGreaterThan(0);
    // No mismatched h2 opening with h3 closing
    expect(html).not.toMatch(/<h2 class="footer-col-title">[^<]*<\/h3>/);
  });

  // --- MF-3: Contact form catch shows error, not success ---
  it("contact form catch block shows error message, not success (MF-3)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    const html = readFileSync(join(outputDir, "contact.html"), "utf-8");
    // Catch block should use errorEl, not successEl
    expect(html).toContain("couldn't send your message");
    expect(html).toContain("errorEl.textContent");
    expect(html).toContain("errorEl.style.display");
    // Should NOT show success in catch block
    expect(html).not.toMatch(/catch\s*\([^)]*\)\s*\{[^}]*successEl/);
  });

  // --- SF-1: About page includes about.png ---
  it("about.html includes about.png image (SF-1)", async () => {
    await buildSite(
      {
        ...minimalInput,
        outputDir,
        about: { story: "Our story" },
      },
      { imageProvider: provider }
    );
    const html = readFileSync(join(outputDir, "about.html"), "utf-8");
    expect(html).toContain('src="images/about.png"');
    expect(html).toContain("about-photo");
  });
});
