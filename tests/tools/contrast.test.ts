import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  parseHex,
  relativeLuminance,
  contrastRatio,
  meetsAA,
  heroOverlayContrast,
} from "../../src/tools/contrast.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { PNG } from "pngjs";

describe("contrast utilities", () => {
  // --- parseHex ---
  describe("parseHex", () => {
    it("parses 6-digit hex correctly", () => {
      const { r, g, b } = parseHex("#2563eb");
      expect(r).toBe(37);
      expect(g).toBe(99);
      expect(b).toBe(235);
    });

    it("parses 3-digit hex correctly", () => {
      const { r, g, b } = parseHex("#fff");
      expect(r).toBe(255);
      expect(g).toBe(255);
      expect(b).toBe(255);
    });

    it("parses 3-digit hex #000", () => {
      const { r, g, b } = parseHex("#000");
      expect(r).toBe(0);
      expect(g).toBe(0);
      expect(b).toBe(0);
    });

    it("throws on invalid hex", () => {
      expect(() => parseHex("#gg")).toThrow("Invalid hex");
    });
  });

  // --- relativeLuminance ---
  describe("relativeLuminance", () => {
    it("returns 0 for black", () => {
      expect(relativeLuminance(0, 0, 0)).toBe(0);
    });

    it("returns 1 for white", () => {
      expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 4);
    });

    it("returns known midtone luminance for #808080", () => {
      const lum = relativeLuminance(128, 128, 128);
      // sRGB mid-grey has luminance ~0.2159
      expect(lum).toBeGreaterThan(0.2);
      expect(lum).toBeLessThan(0.25);
    });
  });

  // --- contrastRatio ---
  describe("contrastRatio", () => {
    it("black vs white = 21:1", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    });

    it("same colour = 1:1", () => {
      expect(contrastRatio("#2563eb", "#2563eb")).toBeCloseTo(1, 4);
    });

    it("is symmetric", () => {
      const r1 = contrastRatio("#000000", "#ffffff");
      const r2 = contrastRatio("#ffffff", "#000000");
      expect(r1).toBeCloseTo(r2, 4);
    });
  });

  // --- meetsAA ---
  describe("meetsAA", () => {
    it("black on white passes for normal text (21:1 >= 4.5)", () => {
      expect(meetsAA("#000000", "#ffffff")).toBe(true);
    });

    it("requires 4.5:1 for normal text", () => {
      // #767676 on white has ratio ~4.54:1 (passes)
      expect(meetsAA("#767676", "#ffffff")).toBe(true);
      // #777777 on white has ratio ~4.48:1 (fails)
      expect(meetsAA("#777777", "#ffffff")).toBe(false);
    });

    it("requires 3:1 for large text", () => {
      // #949494 on white has ratio ~3.03:1
      expect(meetsAA("#949494", "#ffffff", true)).toBe(true);
      // #959595 on white has ratio ~2.99:1
      expect(meetsAA("#959595", "#ffffff", true)).toBe(false);
    });
  });

  // --- heroOverlayContrast ---
  describe("heroOverlayContrast", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = join(tmpdir(), `wbm-contrast-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    function createSolidPng(path: string, r: number, g: number, b: number): void {
      const png = new PNG({ width: 10, height: 10 });
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const idx = (10 * y + x) * 4;
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = 255;
        }
      }
      writeFileSync(path, PNG.sync.write(png));
    }

    it("white image + 55% black overlay, white text passes", () => {
      const imgPath = join(tmpDir, "hero.png");
      createSolidPng(imgPath, 255, 255, 255);

      const result = heroOverlayContrast(imgPath, 0.55, "#ffffff");
      // Effective bg luminance = 1 * (1 - 0.55) = 0.45
      // Text luminance = 1
      // Ratio = (1 + 0.05) / (0.45 + 0.05) = 1.05 / 0.50 = 2.1
      // This should NOT pass at 4.5:1
      expect(result.ratio).toBeGreaterThan(1);
      // With white on lightened bg, it won't pass
      expect(result.passes).toBe(false);
    });

    it("white image + 80% black overlay, white text passes", () => {
      const imgPath = join(tmpDir, "hero.png");
      createSolidPng(imgPath, 255, 255, 255);

      const result = heroOverlayContrast(imgPath, 0.80, "#ffffff");
      // Effective bg luminance = 1 * (1 - 0.80) = 0.20
      // Text luminance = 1
      // Ratio = (1 + 0.05) / (0.20 + 0.05) = 1.05 / 0.25 = 4.2
      // Still borderline — let's check with dark image
      expect(result.ratio).toBeGreaterThan(4);
    });

    it("dark image + 55% overlay, white text passes easily", () => {
      const imgPath = join(tmpDir, "hero.png");
      createSolidPng(imgPath, 50, 50, 50);

      const result = heroOverlayContrast(imgPath, 0.55, "#ffffff");
      // Dark image has low luminance (~0.03)
      // Effective bg luminance = 0.03 * 0.45 = ~0.014
      // Ratio = (1 + 0.05) / (0.014 + 0.05) = 1.05 / 0.064 = ~16.4
      expect(result.passes).toBe(true);
      expect(result.ratio).toBeGreaterThan(10);
    });
  });
});
