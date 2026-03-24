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

  it("creates images/hero.jpg (SVG from mock)", async () => {
    await buildSite({ ...minimalInput, outputDir }, { imageProvider: provider });
    expect(existsSync(join(outputDir, "images/hero.jpg"))).toBe(true);
    const content = readFileSync(join(outputDir, "images/hero.jpg"), "utf-8");
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
    expect(existsSync(join(outputDir, "images/service-espresso.jpg"))).toBe(true);
    expect(existsSync(join(outputDir, "images/service-latte-art.jpg"))).toBe(true);
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
    expect(existsSync(join(outputDir, "images/about.jpg"))).toBe(true);
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
    expect(html).toContain("images/hero.jpg");
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
});
