import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateTests } from "../../src/tools/run-tests.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("generateTests", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-runtests-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("generates HTML structure tests when index.html is present", () => {
    writeFileSync(join(siteDir, "index.html"), "<html><body><h1>Test</h1></body></html>");

    const result = generateTests(siteDir);

    const htmlTestFile = result.testFiles.find((f) => f.type === "unit");
    expect(htmlTestFile).toBeDefined();
    expect(htmlTestFile!.content).toContain("index.html");
  });

  it("generates shop tests when shop.html is present", () => {
    writeFileSync(join(siteDir, "index.html"), "<html><body></body></html>");
    writeFileSync(join(siteDir, "shop.html"), "<html><body><h1>Shop</h1></body></html>");

    const result = generateTests(siteDir);

    const shopTestFile = result.testFiles.find((f) => f.path.includes("shop"));
    expect(shopTestFile).toBeDefined();
    expect(shopTestFile!.content).toContain("shop.html");
  });

  it("does not generate shop tests when shop.html is absent", () => {
    writeFileSync(join(siteDir, "index.html"), "<html><body></body></html>");

    const result = generateTests(siteDir);

    const shopTestFile = result.testFiles.find((f) => f.path.includes("shop"));
    expect(shopTestFile).toBeUndefined();
  });

  it("returns a summary string with test file count", () => {
    writeFileSync(join(siteDir, "index.html"), "<html><body></body></html>");

    const result = generateTests(siteDir);

    expect(typeof result.summary).toBe("string");
    expect(result.summary).toContain("1");
    expect(result.testFiles.length).toBeGreaterThanOrEqual(1);
  });
});
