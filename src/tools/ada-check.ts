import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSiteFiles } from "./site-reader.js";

export const AdaCheckInput = {
  siteDir: z.string().describe("Absolute path to the site directory to check"),
};

export interface AdaViolation {
  severity: "critical" | "serious" | "minor";
  description: string;
  element?: string;
  suggestion?: string;
}

export interface AdaCheckResult {
  passed: boolean;
  violations: AdaViolation[];
}

export function adaCheck(siteDir: string): AdaCheckResult {
  const { htmlFiles, cssFiles } = readSiteFiles(siteDir);

  const allHtml = htmlFiles.map((f) => f.content).join("\n");
  const allCss = cssFiles.map((f) => f.content).join("\n");

  const violations: AdaViolation[] = [];

  // --- Critical: Lang attribute on html element ---
  const hasLang = /<html[^>]+\blang\s*=/i.test(allHtml);
  if (!hasLang) {
    violations.push({
      severity: "critical",
      description: "Missing lang attribute on <html> element",
      element: "<html>",
      suggestion: 'Add lang="en-AU" (or appropriate locale) to the <html> tag',
    });
  }

  // --- Critical: All images have alt attributes ---
  const imgTags = allHtml.match(/<img\b[^>]*>/gi) ?? [];
  const imgsMissingAlt = imgTags.filter((tag) => !/\balt\s*=\s*["'][^"']*["']/i.test(tag));
  if (imgsMissingAlt.length > 0) {
    violations.push({
      severity: "critical",
      description: `${imgsMissingAlt.length} image(s) missing alt attribute`,
      element: imgsMissingAlt[0],
      suggestion: 'Add descriptive alt text to all <img> elements. Use alt="" for decorative images.',
    });
  }

  // --- Critical: Skip-to-content link ---
  const hasSkipLink =
    /href\s*=\s*["']#(?:main[-_]?content|content|skip)["']/i.test(allHtml) &&
    /skip[-_]?to[-_]?content|skip.*content|skiplink/i.test(allHtml);
  if (!hasSkipLink) {
    violations.push({
      severity: "critical",
      description: "Missing skip-to-content link",
      suggestion: 'Add <a href="#main-content" class="skip-to-content">Skip to content</a> as the first element in <body>',
    });
  }

  // --- Serious: All form inputs have associated labels ---
  // Find inputs that are not hidden/submit/button/image type
  const inputTags = allHtml.match(/<input\b[^>]*>/gi) ?? [];
  const labelableInputs = inputTags.filter((tag) => {
    const typeMatch = tag.match(/\btype\s*=\s*["']([^"']*)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "text";
    return !["hidden", "submit", "button", "image", "reset"].includes(type);
  });

  for (const input of labelableInputs) {
    const idMatch = input.match(/\bid\s*=\s*["']([^"']*)["']/i);
    if (!idMatch) {
      // No id — check for wrapping label by looking at surrounding context
      violations.push({
        severity: "serious",
        description: "Form input missing id attribute — cannot be associated with a <label>",
        element: input,
        suggestion: 'Add a unique id to the input and a matching <label for="id"> element',
      });
      continue;
    }
    const inputId = idMatch[1];
    // Check for matching label (for="id") or wrapping label
    const hasForLabel = new RegExp(`<label[^>]+for\\s*=\\s*["']${inputId}["']`, "i").test(allHtml);
    if (!hasForLabel) {
      violations.push({
        severity: "serious",
        description: `Input id="${inputId}" has no associated <label for="${inputId}">`,
        element: input,
        suggestion: `Add <label for="${inputId}">Descriptive label</label> before the input`,
      });
    }
  }

  // --- Serious: Heading hierarchy (no skipped levels) ---
  const headingMatches = allHtml.match(/<h([1-6])[\s>]/gi) ?? [];
  const headingLevels = headingMatches.map((h) => parseInt(h.match(/h([1-6])/i)![1]));
  let prevLevel = 0;
  for (const level of headingLevels) {
    if (prevLevel > 0 && level > prevLevel + 1) {
      violations.push({
        severity: "serious",
        description: `Heading level skipped: h${prevLevel} → h${level} (missing h${prevLevel + 1})`,
        suggestion: `Use sequential heading levels — do not skip from h${prevLevel} to h${level}`,
      });
      break; // Report first occurrence only to avoid noise
    }
    prevLevel = level;
  }

  // --- Serious: :focus-visible styles ---
  const hasFocusVisible = /:focus-visible/.test(allCss);
  if (!hasFocusVisible) {
    violations.push({
      severity: "serious",
      description: "No :focus-visible styles in CSS",
      suggestion: "Add *:focus-visible { outline: 2px solid var(--color-primary); } to styles.css",
    });
  }

  // --- Minor: ARIA landmarks present ---
  const hasHeader = /<header[\s>]/i.test(allHtml) || /role\s*=\s*["']banner["']/i.test(allHtml);
  const hasNav = /<nav[\s>]/i.test(allHtml) || /role\s*=\s*["']navigation["']/i.test(allHtml);
  const hasMain = /<main[\s>]/i.test(allHtml) || /role\s*=\s*["']main["']/i.test(allHtml);
  const hasFooter = /<footer[\s>]/i.test(allHtml) || /role\s*=\s*["']contentinfo["']/i.test(allHtml);
  const missingLandmarks: string[] = [];
  if (!hasHeader) missingLandmarks.push("<header>");
  if (!hasNav) missingLandmarks.push("<nav>");
  if (!hasMain) missingLandmarks.push("<main>");
  if (!hasFooter) missingLandmarks.push("<footer>");
  if (missingLandmarks.length > 0) {
    violations.push({
      severity: "minor",
      description: `Missing ARIA landmark elements: ${missingLandmarks.join(", ")}`,
      suggestion: "Use semantic HTML5 landmark elements for screen reader navigation",
    });
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

export function registerAdaCheck(server: McpServer): void {
  server.registerTool(
    "ada_check",
    {
      description:
        "WCAG 2.1 AA static analysis — checks lang, alt text, skip link, form labels, heading hierarchy, focus styles, ARIA landmarks",
      inputSchema: AdaCheckInput,
    },
    async (args) => {
      const result = adaCheck((args as { siteDir: string }).siteDir);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
