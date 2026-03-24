/**
 * WCAG contrast ratio utilities for automated accessibility checks.
 * Pure utility module — no MCP registration.
 */

import { readFileSync } from "fs";
import { PNG } from "pngjs";

/**
 * Parse a hex colour string ("#abcdef" or "#abc") to {r, g, b} in 0-255 range.
 */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  throw new Error(`Invalid hex colour: ${hex}`);
}

/**
 * Calculate relative luminance of an sRGB colour.
 * Uses the sRGB linearisation formula from WCAG 2.1.
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate WCAG contrast ratio between two hex colours.
 * Returns a value between 1 and 21.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const c1 = parseHex(hex1);
  const c2 = parseHex(hex2);
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check whether two colours meet WCAG AA contrast requirements.
 * Normal text: 4.5:1. Large text (18pt+ or 14pt bold): 3:1.
 */
export function meetsAA(hex1: string, hex2: string, largeText?: boolean): boolean {
  const ratio = contrastRatio(hex1, hex2);
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Read a PNG file and return the average luminance of the brightest 10% of pixels.
 * Used for hero image overlay contrast estimation.
 */
export function samplePngBrightestLuminance(pngPath: string): number {
  const buffer = readFileSync(pngPath);
  const png = PNG.sync.read(buffer);
  const luminances: number[] = [];

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      luminances.push(relativeLuminance(r, g, b));
    }
  }

  luminances.sort((a, b) => b - a);
  const top10Count = Math.max(1, Math.floor(luminances.length * 0.1));
  const top10 = luminances.slice(0, top10Count);
  return top10.reduce((sum, l) => sum + l, 0) / top10.length;
}

/**
 * Calculate effective contrast of text rendered over a semi-transparent
 * overlay on top of a hero image.
 *
 * Models: text colour over (overlay blended over brightest image region).
 * overlay is assumed black with given opacity.
 */
export function heroOverlayContrast(
  heroImagePath: string,
  overlayOpacity: number,
  textHex: string
): { ratio: number; passes: boolean } {
  const imageLum = samplePngBrightestLuminance(heroImagePath);

  // Blend black overlay (luminance 0) over image brightest region
  // effective luminance = imageLum * (1 - overlayOpacity)
  const effectiveBgLum = imageLum * (1 - overlayOpacity);

  const textColor = parseHex(textHex);
  const textLum = relativeLuminance(textColor.r, textColor.g, textColor.b);

  const lighter = Math.max(effectiveBgLum, textLum);
  const darker = Math.min(effectiveBgLum, textLum);
  const ratio = (lighter + 0.05) / (darker + 0.05);

  return { ratio, passes: ratio >= 4.5 };
}
