import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigSchema, type Palette, type ImageProvider } from "../../src/types.js";
import { createImageProvider, generateSvgPlaceholder, createMockProvider } from "../../src/tools/image-generator.js";
import { readFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("ConfigSchema", () => {
  it("includes google and unsplash fields with defaults", () => {
    const config = ConfigSchema.parse({});
    expect(config.google.apiKey).toBe("");
    expect(config.unsplash.accessKey).toBe("");
  });
});

describe("Palette type", () => {
  it("has all required colour fields", () => {
    const palette: Palette = {
      bg: "#0f172a", bgAlt: "#1e293b", text: "#e2e8f0", textMuted: "#94a3b8",
      primary: "#2563eb", primaryDark: "#1e40af", accent: "#f59e0b",
      surface: "#1e293b", border: "#334155",
    };
    expect(palette.bg).toBe("#0f172a");
    expect(Object.keys(palette)).toHaveLength(9);
  });
});

describe("createImageProvider", () => {
  it("returns imagen-4.0-fast provider when google apiKey is set", () => {
    const config = ConfigSchema.parse({ google: { apiKey: "test-key" } });
    const provider = createImageProvider(config);
    expect(provider.name).toBe("imagen-4.0-fast");
  });

  it("returns unsplash provider when only unsplash accessKey is set", () => {
    const config = ConfigSchema.parse({ unsplash: { accessKey: "test-key" } });
    const provider = createImageProvider(config);
    expect(provider.name).toBe("unsplash");
  });

  it("returns svg-placeholder provider when no keys are set", () => {
    const config = ConfigSchema.parse({});
    const provider = createImageProvider(config);
    expect(provider.name).toBe("svg-placeholder");
  });
});

describe("generateSvgPlaceholder", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `svg-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates an SVG file with palette colours", () => {
    const out = join(tmpDir, "test.svg");
    generateSvgPlaceholder("Coffee shop hero", "#b45309", out);
    const svg = readFileSync(out, "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#b45309");
  });

  it("defs block comes before elements that reference it", () => {
    const out = join(tmpDir, "test.svg");
    generateSvgPlaceholder("Test", "#2563eb", out);
    const svg = readFileSync(out, "utf-8");
    const defsPos = svg.indexOf("<defs>");
    const rectWithGradPos = svg.indexOf("url(#grad)");
    expect(defsPos).toBeGreaterThanOrEqual(0);
    expect(rectWithGradPos).toBeGreaterThan(defsPos);
  });
});

describe("createMockProvider", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `mock-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates a file at the output path", async () => {
    const provider = createMockProvider();
    const out = join(tmpDir, "mock.svg");
    await provider.generate("A test image", out);
    expect(existsSync(out)).toBe(true);
  });

  it("has name 'mock'", () => {
    const provider = createMockProvider();
    expect(provider.name).toBe("mock");
  });
});
