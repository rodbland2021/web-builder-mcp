import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSiteFiles } from "./site-reader.js";
import { existsSync } from "fs";
import { join } from "path";

export const ReviewSiteInput = {
  siteDir: z.string().describe("Absolute path to the site directory to review"),
};

export interface ReviewCheck {
  name: string;
  passed: boolean;
  details?: string;
}

export interface ReviewSiteResult {
  passed: boolean;
  score: number;
  total: number;
  checks: ReviewCheck[];
}

export function reviewSite(siteDir: string): ReviewSiteResult {
  const { htmlFiles, cssFiles } = readSiteFiles(siteDir);

  const allHtml = htmlFiles.map((f) => f.content).join("\n");
  const allCss = cssFiles.map((f) => f.content).join("\n");

  const checks: ReviewCheck[] = [];

  // --- CSS checks ---

  // No inline styles
  const inlineStyleMatch = /style\s*=\s*["'][^"']*["']/i.test(allHtml);
  checks.push({
    name: "no-inline-styles",
    passed: !inlineStyleMatch,
    details: inlineStyleMatch
      ? "Inline style attributes found in HTML — move to CSS custom properties"
      : undefined,
  });

  // CSS custom properties in :root
  const hasRoot = /:root\s*\{/.test(allCss);
  const hasCssVars = /--[\w-]+\s*:/.test(allCss);
  checks.push({
    name: "css-custom-properties",
    passed: hasRoot && hasCssVars,
    details:
      !hasRoot || !hasCssVars
        ? "CSS custom properties (variables) should be declared in :root {}"
        : undefined,
  });

  // No !important
  const hasImportant = /!important/.test(allCss);
  checks.push({
    name: "no-css-important",
    passed: !hasImportant,
    details: hasImportant ? "!important found in CSS — refactor specificity instead" : undefined,
  });

  // --- A11y checks ---

  // Skip-to-content link — matches href="#main", "#main-content", "#content", "#skip"
  // with class "skip-link", "skip-to-content", "skiplink", or text containing "skip"
  const hasSkipLink =
    /href\s*=\s*["']#(?:main[-_]?content|main|content|skip)["']/i.test(allHtml) &&
    /skip[-_]?link|skip[-_]?to[-_]?content|skip.*content|skiplink/i.test(allHtml);
  checks.push({
    name: "skip-to-content",
    passed: hasSkipLink,
    details: hasSkipLink
      ? undefined
      : "Add a skip-to-content link as the first focusable element",
  });

  // :focus-visible styles
  const hasFocusVisible = /:focus-visible/.test(allCss);
  checks.push({
    name: "focus-visible-styles",
    passed: hasFocusVisible,
    details: hasFocusVisible
      ? undefined
      : "Add :focus-visible styles in CSS for keyboard navigation visibility",
  });

  // Alt attributes on images
  const imgTags = allHtml.match(/<img\b[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgTags.filter((tag) => !/\balt\s*=\s*["'][^"']*["']/i.test(tag));
  checks.push({
    name: "img-alt-attributes",
    passed: imgsMissingAlt.length === 0,
    details:
      imgsMissingAlt.length > 0
        ? `${imgsMissingAlt.length} image(s) missing alt attribute`
        : undefined,
  });

  // Lang attribute on html element
  const hasLang = /<html[^>]+\blang\s*=/i.test(allHtml);
  checks.push({
    name: "html-lang-attribute",
    passed: hasLang,
    details: hasLang ? undefined : "Add lang attribute to <html> element (e.g. lang=\"en-AU\")",
  });

  // --- Mobile checks ---

  // Mobile nav toggle present
  const hasNavToggle = /nav[-_]?toggle|hamburger|mobile[-_]?menu/i.test(allHtml);
  checks.push({
    name: "mobile-nav-toggle",
    passed: hasNavToggle,
    details: hasNavToggle
      ? undefined
      : "Add a mobile navigation toggle (class: nav-toggle or hamburger)",
  });

  // Viewport meta
  const hasViewport = /<meta[^>]+name\s*=\s*["']viewport["']/i.test(allHtml);
  checks.push({
    name: "viewport-meta",
    passed: hasViewport,
    details: hasViewport
      ? undefined
      : 'Add <meta name="viewport" content="width=device-width, initial-scale=1.0">',
  });

  // --- Content checks ---

  // Dynamic copyright year — detect inline JS call OR a span.copyright-year element
  // that site.js populates dynamically via querySelectorAll('.copyright-year')
  const { jsFiles } = readSiteFiles(siteDir);
  const allJs = jsFiles.map((f) => f.content).join("\n");
  const hasDynamicYear =
    /new Date\(\)\.getFullYear\(\)|getFullYear\(\)/.test(allHtml) ||
    (/copyright-year/.test(allHtml) && /getFullYear\(\)/.test(allJs));
  checks.push({
    name: "dynamic-copyright-year",
    passed: hasDynamicYear,
    details: hasDynamicYear
      ? undefined
      : "Use new Date().getFullYear() for copyright year to keep it current",
  });

  // LD+JSON present
  const hasLdJson = /application\/ld\+json/i.test(allHtml);
  checks.push({
    name: "structured-data-ldjson",
    passed: hasLdJson,
    details: hasLdJson
      ? undefined
      : "Add LD+JSON structured data (<script type=\"application/ld+json\">) for SEO",
  });

  const score = checks.filter((c) => c.passed).length;
  const total = checks.length;

  return {
    passed: score === total,
    score,
    total,
    checks,
  };
}

export function registerReviewSite(server: McpServer): void {
  server.registerTool(
    "review_site",
    {
      description:
        "Runs a 11-item quality checklist against a generated site directory — CSS, accessibility, mobile, and content checks",
      inputSchema: ReviewSiteInput,
    },
    async (args) => {
      const result = reviewSite((args as { siteDir: string }).siteDir);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
