import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSite } from "../../src/tools/build-site.js";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("buildSite", () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = join(tmpdir(), `wbm-build-${Date.now()}`);
    mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(outputDir, { recursive: true, force: true });
  });

  const minimalInput = {
    businessName: "Sunrise Café",
    businessType: "service" as const,
    location: "Melbourne, VIC",
    outputDir: "", // set in beforeEach
  };

  it("creates index.html", () => {
    buildSite({ ...minimalInput, outputDir });
    expect(existsSync(join(outputDir, "index.html"))).toBe(true);
  });

  it("creates styles.css with custom properties", () => {
    buildSite({ ...minimalInput, outputDir });
    const css = readFileSync(join(outputDir, "styles.css"), "utf-8");
    expect(css).toContain(":root");
    expect(css).toContain("--color-primary");
  });

  it("creates site.js", () => {
    buildSite({ ...minimalInput, outputDir });
    expect(existsSync(join(outputDir, "site.js"))).toBe(true);
  });

  it("index.html contains business name", () => {
    buildSite({ ...minimalInput, outputDir });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("Sunrise Café");
  });

  it("creates about.html for service business", () => {
    buildSite({ ...minimalInput, outputDir });
    expect(existsSync(join(outputDir, "about.html"))).toBe(true);
  });

  it("creates robots.txt and sitemap.xml", () => {
    buildSite({ ...minimalInput, outputDir });
    expect(existsSync(join(outputDir, "robots.txt"))).toBe(true);
    expect(existsSync(join(outputDir, "sitemap.xml"))).toBe(true);
  });

  it("includes LD+JSON structured data", () => {
    buildSite({ ...minimalInput, outputDir });
    const html = readFileSync(join(outputDir, "index.html"), "utf-8");
    expect(html).toContain("application/ld+json");
  });

  it("returns list of created files", () => {
    const result = buildSite({ ...minimalInput, outputDir });
    expect(result.files.length).toBeGreaterThan(3);
    expect(result.files).toContain("index.html");
    expect(result.files).toContain("styles.css");
  });
});
