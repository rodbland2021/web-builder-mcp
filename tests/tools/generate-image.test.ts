import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateImage } from "../../src/tools/generate-image.js";
import { createMockProvider } from "../../src/tools/image-generator.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("generateImage", () => {
  let tmpDir: string;
  const mockProvider = createMockProvider();

  beforeEach(() => {
    tmpDir = join(tmpdir(), `gen-image-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates file at outputPath", async () => {
    const outputPath = join(tmpDir, "test-image.jpg");
    const result = await generateImage({ prompt: "A sunset over Sydney Harbour", outputPath }, { imageProvider: mockProvider });
    expect(existsSync(outputPath)).toBe(true);
    expect(result.filePath).toBe(outputPath);
  });

  it("returns enhanced prompt containing the original prompt", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "A sunset over Sydney Harbour", outputPath }, { imageProvider: mockProvider });
    expect(result.enhancedPrompt).toContain("A sunset over Sydney Harbour");
  });

  it("applies style modifiers to the enhanced prompt", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "Product hero image", style: "luxury", outputPath }, { imageProvider: mockProvider });
    expect(result.enhancedPrompt).toContain("Premium, sophisticated, rich colors, polished surfaces");
  });

  it("includes dimensions in the result", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "Banner image", width: 800, height: 400, outputPath }, { imageProvider: mockProvider });
    expect(result.dimensions.width).toBe(800);
    expect(result.dimensions.height).toBe(400);
  });

  it("defaults style to modern", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "Hero section background", outputPath }, { imageProvider: mockProvider });
    expect(result.style).toBe("modern");
    expect(result.enhancedPrompt).toContain("Clean, contemporary design with bold typography and generous whitespace");
  });

  it("returns provider name", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "Test image", outputPath }, { imageProvider: mockProvider });
    expect(result.provider).toBe("mock");
  });

  it("returns cost estimate", async () => {
    const outputPath = join(tmpDir, "test.jpg");
    const result = await generateImage({ prompt: "Test image", outputPath }, { imageProvider: mockProvider });
    expect(result.estimatedCost).toBeDefined();
    expect(typeof result.estimatedCost).toBe("string");
  });

  it("saves to a temp location when no outputPath provided", async () => {
    const result = await generateImage({ prompt: "Test image" }, { imageProvider: mockProvider });
    expect(result.filePath).toBeTruthy();
    expect(existsSync(result.filePath)).toBe(true);
    // Clean up temp file
    rmSync(result.filePath, { force: true });
  });
});
