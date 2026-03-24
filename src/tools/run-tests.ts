import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { existsSync, statSync } from "fs";
import { join } from "path";

export const RunTestsInput = {
  siteDir: z.string().describe("Absolute path to the site directory to generate tests for"),
};

export interface TestFile {
  path: string;
  content: string;
  type: "unit" | "e2e";
}

export interface GenerateTestsResult {
  testFiles: TestFile[];
  summary: string;
}

function generateHtmlStructureTests(siteDir: string): TestFile {
  return {
    path: "tests/html-structure.test.ts",
    type: "unit",
    content: `import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SITE_DIR = ${JSON.stringify(siteDir)};

describe("HTML structure", () => {
  it("index.html exists", () => {
    expect(existsSync(join(SITE_DIR, "index.html"))).toBe(true);
  });

  it("index.html has a title tag", () => {
    const html = readFileSync(join(SITE_DIR, "index.html"), "utf-8");
    expect(html).toMatch(/<title[^>]*>[^<]+<\\/title>/i);
  });

  it("index.html has a viewport meta tag", () => {
    const html = readFileSync(join(SITE_DIR, "index.html"), "utf-8");
    expect(html).toMatch(/<meta[^>]+name=["']viewport["']/i);
  });

  it("index.html has lang attribute on html element", () => {
    const html = readFileSync(join(SITE_DIR, "index.html"), "utf-8");
    expect(html).toMatch(/<html[^>]+lang=/i);
  });

  it("index.html contains an h1", () => {
    const html = readFileSync(join(SITE_DIR, "index.html"), "utf-8");
    expect(html).toMatch(/<h1[\\s>]/i);
  });

  it("styles.css exists", () => {
    expect(existsSync(join(SITE_DIR, "styles.css"))).toBe(true);
  });

  it("site.js exists", () => {
    expect(existsSync(join(SITE_DIR, "site.js"))).toBe(true);
  });
});
`,
  };
}

function generateShopTests(siteDir: string): TestFile {
  return {
    path: "tests/shop.test.ts",
    type: "unit",
    content: `import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SITE_DIR = ${JSON.stringify(siteDir)};

describe("Shop page", () => {
  it("shop.html exists", () => {
    expect(existsSync(join(SITE_DIR, "shop.html"))).toBe(true);
  });

  it("shop.html has a product listing section", () => {
    const html = readFileSync(join(SITE_DIR, "shop.html"), "utf-8");
    expect(html).toMatch(/product|shop-grid|product-grid/i);
  });

  it("shop.html has a cart trigger element", () => {
    const html = readFileSync(join(SITE_DIR, "shop.html"), "utf-8");
    expect(html).toMatch(/cart|basket/i);
  });
});
`,
  };
}

function generateBookingTests(siteDir: string): TestFile {
  return {
    path: "tests/booking.test.ts",
    type: "unit",
    content: `import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SITE_DIR = ${JSON.stringify(siteDir)};

describe("Booking page", () => {
  it("book.html exists", () => {
    expect(existsSync(join(SITE_DIR, "book.html"))).toBe(true);
  });

  it("book.html has a form element", () => {
    const html = readFileSync(join(SITE_DIR, "book.html"), "utf-8");
    expect(html).toMatch(/<form/i);
  });

  it("book.html has a submit button", () => {
    const html = readFileSync(join(SITE_DIR, "book.html"), "utf-8");
    expect(html).toMatch(/type=["']submit["']|<button[^>]*>.*book/i);
  });
});
`,
  };
}

function generateWorkerTests(siteDir: string): TestFile {
  return {
    path: "tests/worker-api.test.ts",
    type: "unit",
    content: `import { describe, it, expect } from "vitest";
import { existsSync, readdirSync } from "fs";
import { join } from "path";

const WORKERS_DIR = ${JSON.stringify(join(siteDir, "workers"))};

describe("Worker API files", () => {
  it("workers directory exists", () => {
    expect(existsSync(WORKERS_DIR)).toBe(true);
  });

  it("workers directory contains at least one .js file", () => {
    const files = readdirSync(WORKERS_DIR);
    const jsFiles = files.filter((f) => f.endsWith(".js"));
    expect(jsFiles.length).toBeGreaterThan(0);
  });
});
`,
  };
}

export function generateTests(siteDir: string): GenerateTestsResult {
  const testFiles: TestFile[] = [];

  if (existsSync(join(siteDir, "index.html"))) {
    testFiles.push(generateHtmlStructureTests(siteDir));
  }

  if (existsSync(join(siteDir, "shop.html"))) {
    testFiles.push(generateShopTests(siteDir));
  }

  if (existsSync(join(siteDir, "book.html"))) {
    testFiles.push(generateBookingTests(siteDir));
  }

  if (existsSync(join(siteDir, "workers")) && statSync(join(siteDir, "workers")).isDirectory()) {
    testFiles.push(generateWorkerTests(siteDir));
  }

  const summary = `Generated ${testFiles.length} test file${testFiles.length === 1 ? "" : "s"}: ${testFiles.map((f) => f.path).join(", ")}. Write these files and run: npm test`;

  return { testFiles, summary };
}

export function registerRunTests(server: McpServer): void {
  server.registerTool(
    "run_tests",
    {
      description:
        "Auto-generates test file content based on what's present in the site directory — HTML structure, shop, booking, and worker API tests",
      inputSchema: RunTestsInput,
    },
    async (args) => {
      const result = generateTests((args as { siteDir: string }).siteDir);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
