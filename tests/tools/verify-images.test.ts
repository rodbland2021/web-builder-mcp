import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyImages } from "../../src/tools/verify-images.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PNG } from "pngjs";

describe("verifyImages", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-verify-img-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  function createTestPng(path: string): void {
    const png = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < 4 * 4 * 4; i += 4) {
      png.data[i] = 100;
      png.data[i + 1] = 150;
      png.data[i + 2] = 200;
      png.data[i + 3] = 255;
    }
    writeFileSync(path, PNG.sync.write(png));
  }

  it("returns skipped when no images/ directory exists", async () => {
    const result = await verifyImages({ siteDir }, { googleApiKey: undefined });
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("No images/");
  });

  it("returns skipped when images/ is empty", async () => {
    mkdirSync(join(siteDir, "images"), { recursive: true });
    const result = await verifyImages({ siteDir }, { googleApiKey: undefined });
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("No image files");
  });

  it("inventories image files without API key", async () => {
    mkdirSync(join(siteDir, "images"), { recursive: true });
    createTestPng(join(siteDir, "images", "hero.png"));
    createTestPng(join(siteDir, "images", "about.png"));

    const result = await verifyImages({ siteDir }, { googleApiKey: undefined });
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toContain("No API key");
    expect(result.images).toHaveLength(2);
    expect(result.images[0].exists).toBe(true);
    expect(result.images[0].sizeBytes).toBeGreaterThan(0);
  });

  it("includes SVG files in inventory", async () => {
    mkdirSync(join(siteDir, "images"), { recursive: true });
    writeFileSync(
      join(siteDir, "images", "icon.svg"),
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="red" width="100" height="100"/></svg>'
    );

    const result = await verifyImages({ siteDir }, { googleApiKey: undefined });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].file).toBe("icon.svg");
  });

  it("ignores non-image files", async () => {
    mkdirSync(join(siteDir, "images"), { recursive: true });
    writeFileSync(join(siteDir, "images", "readme.txt"), "not an image");
    createTestPng(join(siteDir, "images", "hero.png"));

    const result = await verifyImages({ siteDir }, { googleApiKey: undefined });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].file).toBe("hero.png");
  });

  it("returns correct structure with prompts provided (no API key)", async () => {
    mkdirSync(join(siteDir, "images"), { recursive: true });
    createTestPng(join(siteDir, "images", "hero.png"));

    const result = await verifyImages(
      {
        siteDir,
        prompts: [{ file: "hero.png", prompt: "A test hero", purpose: "hero banner" }],
      },
      { googleApiKey: undefined }
    );
    expect(result.passed).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.images[0].file).toBe("hero.png");
  });
});
