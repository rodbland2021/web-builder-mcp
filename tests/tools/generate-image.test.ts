import { describe, it, expect } from "vitest";
import { generateImagePrompt } from "../../src/tools/generate-image.js";

describe("generateImagePrompt", () => {
  it("returns enhanced prompt containing the original prompt", () => {
    const result = generateImagePrompt({ prompt: "A sunset over Sydney Harbour" });
    expect(result.enhancedPrompt).toContain("A sunset over Sydney Harbour");
  });

  it("applies style modifiers to the enhanced prompt", () => {
    const result = generateImagePrompt({ prompt: "Product hero image", style: "luxury" });
    expect(result.enhancedPrompt).toContain("Premium, sophisticated, rich colors, polished surfaces");
  });

  it("includes dimensions in the result", () => {
    const result = generateImagePrompt({ prompt: "Banner image", width: 800, height: 400 });
    expect(result.dimensions.width).toBe(800);
    expect(result.dimensions.height).toBe(400);
  });

  it("defaults style to modern", () => {
    const result = generateImagePrompt({ prompt: "Hero section background" });
    expect(result.style).toBe("modern");
    expect(result.enhancedPrompt).toContain("Clean, contemporary design with bold typography and generous whitespace");
  });
});
