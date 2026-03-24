import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSiteFiles } from "./site-reader.js";
import { existsSync } from "fs";
import { join } from "path";

export const SeoAuditInput = {
  siteDir: z.string().describe("Absolute path to the site directory to audit"),
};

export interface SeoCheck {
  name: string;
  passed: boolean;
  details?: string;
}

export interface SeoAuditResult {
  passed: boolean;
  checks: SeoCheck[];
}

export function seoAudit(siteDir: string): SeoAuditResult {
  const { htmlFiles } = readSiteFiles(siteDir);

  const checks: SeoCheck[] = [];

  // Per-page checks — evaluate against each HTML file
  for (const file of htmlFiles) {
    const html = file.content;
    const label = file.path === "index.html" || htmlFiles.length === 1 ? "" : ` (${file.path})`;

    // Title tag present and non-empty
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const titlePresent = titleMatch !== null && titleMatch[1].trim().length > 0;
    checks.push({
      name: "title-tag",
      passed: titlePresent,
      details: titlePresent
        ? undefined
        : `Missing or empty <title> tag${label}`,
    });

    // Meta description
    const metaDescMatch = /<meta[^>]+name\s*=\s*["']description["'][^>]+content\s*=\s*["']([^"']*)["']/i.test(html) ||
      /<meta[^>]+content\s*=\s*["']([^"']*)["'][^>]+name\s*=\s*["']description["']/i.test(html);
    checks.push({
      name: "meta-description",
      passed: metaDescMatch,
      details: metaDescMatch
        ? undefined
        : `Missing meta description${label}`,
    });

    // H1 present (at least one)
    const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
    checks.push({
      name: "h1-present",
      passed: h1Count >= 1,
      details: h1Count === 0 ? `No <h1> found${label}` : undefined,
    });

    // Canonical link
    const hasCanonical = /<link[^>]+rel\s*=\s*["']canonical["']/i.test(html);
    checks.push({
      name: "canonical-link",
      passed: hasCanonical,
      details: hasCanonical ? undefined : `Missing canonical link tag${label}`,
    });

    // LD+JSON structured data and valid JSON
    const ldJsonMatch = html.match(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
    let ldJsonPassed = false;
    let ldJsonDetails: string | undefined;
    if (ldJsonMatch) {
      try {
        JSON.parse(ldJsonMatch[1]);
        ldJsonPassed = true;
      } catch {
        ldJsonDetails = `LD+JSON structured data is not valid JSON${label}`;
      }
    } else {
      ldJsonDetails = `Missing LD+JSON structured data${label}`;
    }
    checks.push({
      name: "ldjson-structured-data",
      passed: ldJsonPassed,
      details: ldJsonDetails,
    });

    // OG tags
    const hasOgTitle = /<meta[^>]+property\s*=\s*["']og:title["']/i.test(html);
    const hasOgDescription = /<meta[^>]+property\s*=\s*["']og:description["']/i.test(html);
    checks.push({
      name: "og-tags",
      passed: hasOgTitle && hasOgDescription,
      details:
        !hasOgTitle || !hasOgDescription
          ? `Missing OG tags${label}: ${!hasOgTitle ? "og:title" : ""} ${!hasOgDescription ? "og:description" : ""}`.trim()
          : undefined,
    });
  }

  // Site-level file checks (independent of per-page)
  const hasSitemap = existsSync(join(siteDir, "sitemap.xml"));
  checks.push({
    name: "sitemap-xml",
    passed: hasSitemap,
    details: hasSitemap ? undefined : "sitemap.xml not found in site directory",
  });

  const hasRobots = existsSync(join(siteDir, "robots.txt"));
  checks.push({
    name: "robots-txt",
    passed: hasRobots,
    details: hasRobots ? undefined : "robots.txt not found in site directory",
  });

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

export function registerSeoAudit(server: McpServer): void {
  server.registerTool(
    "seo_audit",
    {
      description:
        "Validates SEO elements across all HTML files — title, meta description, H1, canonical, LD+JSON, OG tags, sitemap.xml, robots.txt",
      inputSchema: SeoAuditInput,
    },
    async (args) => {
      const result = seoAudit((args as { siteDir: string }).siteDir);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
