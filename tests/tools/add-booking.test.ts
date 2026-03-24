import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addBooking } from "../../src/tools/add-booking.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("addBooking", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-booking-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "styles.css"), ":root {}");
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("creates book.html with multi-step form", () => {
    addBooking({ siteDir, services: ["Haircut", "Beard Trim"] });
    const html = readFileSync(join(siteDir, "book.html"), "utf-8");
    expect(html).toContain("Haircut");
    expect(html).toContain("Beard Trim");
  });

  it("creates book.css", () => {
    addBooking({ siteDir, services: ["Haircut"] });
    expect(existsSync(join(siteDir, "book.css"))).toBe(true);
  });

  it("creates booking worker", () => {
    addBooking({ siteDir, services: ["Haircut"] });
    expect(existsSync(join(siteDir, "workers", "booking-api", "index.js"))).toBe(true);
  });

  it("worker includes /notify endpoint", () => {
    addBooking({ siteDir, services: ["Haircut"] });
    const worker = readFileSync(join(siteDir, "workers", "booking-api", "index.js"), "utf-8");
    expect(worker).toContain("/notify");
    expect(worker).toContain("/health");
  });

  it("returns created files list", () => {
    const result = addBooking({ siteDir, services: ["Haircut"] });
    expect(result.files).toContain("book.html");
  });
});
