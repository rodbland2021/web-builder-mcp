import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addContact } from "../../src/tools/add-contact.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("addContact", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-contact-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
    writeFileSync(join(siteDir, "styles.css"), ":root {}");
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("creates contact.html with form", () => {
    addContact({ siteDir });
    const html = readFileSync(join(siteDir, "contact.html"), "utf-8");
    expect(html).toContain("<form");
    expect(html).toContain("name");
    expect(html).toContain("email");
    expect(html).toContain("message");
  });

  it("creates contact worker", () => {
    addContact({ siteDir });
    expect(existsSync(join(siteDir, "workers", "contact-api", "index.js"))).toBe(true);
  });

  it("worker includes /notify and /health", () => {
    addContact({ siteDir });
    const worker = readFileSync(join(siteDir, "workers", "contact-api", "index.js"), "utf-8");
    expect(worker).toContain("/notify");
    expect(worker).toContain("/health");
  });

  it("includes required field indicators", () => {
    addContact({ siteDir });
    const html = readFileSync(join(siteDir, "contact.html"), "utf-8");
    expect(html).toContain("required");
  });

  it("returns created files list", () => {
    const result = addContact({ siteDir });
    expect(result.files).toContain("contact.html");
  });
});
