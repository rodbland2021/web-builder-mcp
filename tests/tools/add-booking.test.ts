import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addBooking } from "../../src/tools/add-booking.js";
import { createMockProvider } from "../../src/tools/image-generator.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("addBooking", () => {
  let siteDir: string;
  const mockProvider = createMockProvider();

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-booking-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "styles.css"), ":root {}");
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("creates book.html with multi-step form", async () => {
    await addBooking({ siteDir, services: ["Haircut", "Beard Trim"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("Haircut");
    expect(html).toContain("Beard Trim");
  });

  it("creates book.css", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "book.css"))).toBe(true);
  });

  it("creates booking worker", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "workers", "booking-api", "index.js"))).toBe(true);
  });

  it("worker includes /notify endpoint", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const worker = readFileSync(join(siteDir, "workers", "booking-api", "index.js"), "utf-8");
    expect(worker).toContain("/notify");
    expect(worker).toContain("/health");
  });

  it("returns created files list", async () => {
    const result = await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(result.files).toContain("book.html");
  });

  it("creates images/booking-hero.png via mock provider", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "images", "booking-hero.png"))).toBe(true);
  });

  it("book.html includes booking hero image reference", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("images/booking-hero.png");
  });

  it("returns imagesGenerated: 1", async () => {
    const result = await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(result.imagesGenerated).toBe(1);
  });

  // --- MF-4: No Sunday skip in date generation ---
  it("does not skip Sundays in book.js (MF-4)", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const js = readFileSync(join(siteDir, "book.js"), "utf-8");
    expect(js).not.toContain("getDay() !== 0");
    expect(js).not.toContain("skip Sunday");
  });

  // --- SF-2: Noscript fallback on booking page ---
  it("includes noscript fallback in book.html (SF-2)", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("<noscript>");
    expect(html).toContain("JavaScript is required for online booking");
  });

  it("includes phone in noscript when nav has phone (SF-2)", async () => {
    // Write an index.html with a nav phone
    const indexHtml = `<!DOCTYPE html>
<html lang="en-AU">
<head><title>Test</title></head>
<body>
  <header class="site-header">
    <div class="container nav-inner">
      <a href="index.html" class="nav-logo">Test Biz</a>
      <a href="tel:0412345678" class="nav-phone">0412 345 678</a>
      <nav><ul class="nav-links">
        <li><a href="index.html">Home</a></li>
      </ul></nav>
    </div>
  </header>
</body>
</html>`;
    writeFileSync(join(siteDir, "index.html"), indexHtml);
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("0412 345 678");
    expect(html).toContain("tel:");
  });

  // --- M6: Booking form shows error on API failure ---
  it("book.js catch block shows error, not success (M6)", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const js = readFileSync(join(siteDir, "book.js"), "utf-8");
    // Catch block should call showError, not show success
    expect(js).toContain("showError(");
    expect(js).toContain("could not confirm your booking");
    // Should NOT show success unconditionally after the try/catch
    expect(js).not.toContain("// Show success regardless");
  });

  // --- M7: Booking page includes favicon ---
  it("book.html includes favicon link (M7)", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain('rel="icon" href="favicon.svg"');
  });

  // --- M4: Booking updates sitemap ---
  it("booking updates existing sitemap.xml (M4)", async () => {
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>index.html</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
</urlset>
`;
    writeFileSync(join(siteDir, "sitemap.xml"), sitemap);
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const updatedSitemap = readFileSync(join(siteDir, "sitemap.xml"), "utf-8");
    expect(updatedSitemap).toContain("book.html");
  });
});
