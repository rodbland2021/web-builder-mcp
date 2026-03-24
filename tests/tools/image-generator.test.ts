import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigSchema, type Palette, type ImageProvider } from "../../src/types.js";

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
