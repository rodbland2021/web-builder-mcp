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

  it("creates images/booking-hero.jpg via mock provider", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "images", "booking-hero.jpg"))).toBe(true);
  });

  it("book.html includes booking hero image reference", async () => {
    await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("images/booking-hero.jpg");
  });

  it("returns imagesGenerated: 1", async () => {
    const result = await addBooking({ siteDir, services: ["Haircut"] }, { imageProvider: mockProvider });
    expect(result.imagesGenerated).toBe(1);
  });
});
