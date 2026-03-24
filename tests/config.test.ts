import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig } from "../src/config.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `web-builder-mcp-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("loadConfig", () => {
  it("creates default config when none exists", async () => {
    const config = await loadConfig(tempDir);

    expect(config.cloudflare.apiKey).toBe("");
    expect(config.defaults.currency).toBe("USD");
    expect(config.defaults.language).toBe("en-US");
  });

  it("loads existing config file", async () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        cloudflare: { apiKey: "test-key", email: "", accountId: "" },
        stripe: { testKey: "", liveKey: "", webhookSecret: "" },
        defaults: { currency: "AUD", timezone: "UTC", language: "en-AU" },
      })
    );

    const config = await loadConfig(tempDir);

    expect(config.cloudflare.apiKey).toBe("test-key");
    expect(config.defaults.currency).toBe("AUD");
    expect(config.defaults.language).toBe("en-AU");
  });

  it("returns empty apiKey when keys are empty", async () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        cloudflare: { apiKey: "", email: "", accountId: "" },
      })
    );

    const config = await loadConfig(tempDir);

    expect(config.cloudflare.apiKey).toBe("");
  });

  it("handles malformed JSON gracefully", async () => {
    const configPath = join(tempDir, "config.json");
    writeFileSync(configPath, "{ not valid json }");

    await expect(loadConfig(tempDir)).rejects.toThrow("Invalid JSON in config file");
  });
});
