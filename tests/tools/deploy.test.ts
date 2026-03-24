import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateDeployment } from "../../src/tools/deploy.js";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { Config } from "../../src/config.js";

const validConfig: Config = {
  cloudflare: {
    apiKey: "test-api-key",
    email: "test@example.com",
    accountId: "test-account-id",
  },
  stripe: { testKey: "", liveKey: "", webhookSecret: "" },
  defaults: { currency: "USD", timezone: "UTC", language: "en-US" },
};

const emptyCredConfig: Config = {
  cloudflare: {
    apiKey: "",
    email: "test@example.com",
    accountId: "test-account-id",
  },
  stripe: { testKey: "", liveKey: "", webhookSecret: "" },
  defaults: { currency: "USD", timezone: "UTC", language: "en-US" },
};

describe("validateDeployment", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-deploy-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("fails if siteDir does not exist", () => {
    const result = validateDeployment("/nonexistent/path/abc123", validConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("/nonexistent/path/abc123");
  });

  it("fails if siteDir is empty", () => {
    const result = validateDeployment(siteDir, validConfig);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("fails if CF credentials are missing (apiKey empty)", () => {
    writeFileSync(join(siteDir, "index.html"), "<html></html>", "utf-8");
    const result = validateDeployment(siteDir, emptyCredConfig);
    expect(result.valid).toBe(false);
  });

  it("returns setup instructions when credentials are missing", () => {
    writeFileSync(join(siteDir, "index.html"), "<html></html>", "utf-8");
    const result = validateDeployment(siteDir, emptyCredConfig);
    expect(result.error).toContain("~/.web-builder-mcp/config.json");
  });

  it("validates successfully when siteDir has files and credentials are present", () => {
    writeFileSync(join(siteDir, "index.html"), "<html></html>", "utf-8");
    const result = validateDeployment(siteDir, validConfig);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
