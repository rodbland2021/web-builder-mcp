import { z } from "zod";
import { existsSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSiteFiles } from "./site-reader.js";
import { parseHex, contrastRatio, meetsAA, heroOverlayContrast } from "./contrast.js";

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
  // Matches href="#main", "#main-content", "#content", "#skip"
  // with class "skip-link", "skip-to-content", "skiplink", or text containing "skip"
  const hasSkipLink =
    /href\s*=\s*["']#(?:main[-_]?content|main|content|skip)["']/i.test(allHtml) &&
    /skip[-_]?link|skip[-_]?to[-_]?content|skip.*content|skiplink/i.test(allHtml);
  if (!hasSkipLink) {
    violations.push({
      severity: "critical",
      description: "Missing skip-to-content link",
      suggestion: 'Add <a href="#main" class="skip-link">Skip to content</a> as the first element in <body>',
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
      // Search for <label...>...<input...>...</label> pattern containing this input
      const escapedInput = input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wrappedByLabel = new RegExp(
        `<label[^>]*>[\\s\\S]*?${escapedInput}[\\s\\S]*?<\\/label>`,
        "i"
      ).test(allHtml);
      if (!wrappedByLabel) {
        violations.push({
          severity: "serious",
          description: "Form input missing id attribute — cannot be associated with a <label>",
          element: input,
          suggestion: 'Add a unique id to the input and a matching <label for="id"> element',
        });
      }
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

  // --- Serious: Heading hierarchy (no skipped levels, per file) ---
  for (const file of htmlFiles) {
    const headingMatches = file.content.match(/<h([1-6])[\s>]/gi) ?? [];
    const headingLevels = headingMatches.map((h) => parseInt(h.match(/h([1-6])/i)![1]));
    let prevLevel = 0;
    for (const level of headingLevels) {
      if (prevLevel > 0 && level > prevLevel + 1) {
        violations.push({
          severity: "serious",
          description: `Heading level skipped: h${prevLevel} → h${level} (missing h${prevLevel + 1})`,
          suggestion: `Use sequential heading levels — do not skip from h${prevLevel} to h${level}`,
        });
        break; // Report first occurrence per file only
      }
      prevLevel = level;
    }
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

  // --- Serious: palette-contrast — check CSS variable pairs meet WCAG AA ---
  const paletteVars: Record<string, string> = {};
  const varMatches = allCss.matchAll(/--color-([a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g);
  for (const m of varMatches) {
    paletteVars[m[1]] = m[2];
  }

  // Check critical text-on-background pairs
  const palettePairs: Array<{ fg: string; bg: string; label: string; large?: boolean }> = [
    { fg: "text", bg: "bg", label: "text on bg" },
    { fg: "text-muted", bg: "bg", label: "textMuted on bg" },
    { fg: "text", bg: "surface", label: "text on surface" },
    { fg: "text-muted", bg: "surface", label: "textMuted on surface" },
    { fg: "text", bg: "bg-alt", label: "text on bgAlt" },
  ];

  for (const pair of palettePairs) {
    const fgHex = paletteVars[pair.fg];
    const bgHex = paletteVars[pair.bg];
    if (fgHex && bgHex) {
      try {
        if (!meetsAA(fgHex, bgHex, pair.large)) {
          const ratio = contrastRatio(fgHex, bgHex);
          violations.push({
            severity: "serious",
            description: `Palette contrast fail: ${pair.label} (${fgHex} on ${bgHex}) ratio ${ratio.toFixed(1)}:1, needs 4.5:1`,
            suggestion: `Darken the foreground or lighten the background to achieve at least 4.5:1 contrast`,
          });
        }
      } catch {
        // Skip invalid hex values
      }
    }
  }

  // --- Serious: hero-overlay-contrast — check text over hero overlay ---
  const heroImagePath = join(siteDir, "images", "hero.png");
  if (existsSync(heroImagePath)) {
    // Default overlay is rgba(0,0,0,0.55) from templates.ts
    let overlayOpacity = 0.55;
    const overlayMatch = allCss.match(/\.hero-overlay\s*\{[^}]*background:\s*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/);
    if (overlayMatch) {
      overlayOpacity = parseFloat(overlayMatch[1]);
    }

    try {
      const result = heroOverlayContrast(heroImagePath, overlayOpacity, "#ffffff");
      if (!result.passes) {
        violations.push({
          severity: "serious",
          description: `Hero overlay contrast insufficient: white text over ${(overlayOpacity * 100).toFixed(0)}% overlay has ratio ${result.ratio.toFixed(1)}:1, needs 4.5:1`,
          suggestion: `Increase overlay opacity (currently ${(overlayOpacity * 100).toFixed(0)}%) or darken the hero image`,
        });
      }
    } catch {
      // Skip if PNG can't be read (e.g. SVG placeholder)
    }
  }

  // --- Minor: focus-ring-contrast — check focus ring against bg and surface ---
  const focusRingMatch = allCss.match(/:focus-visible\s*\{[^}]*outline:\s*[^;]*(#[0-9a-fA-F]{3,6})\b/);
  if (focusRingMatch) {
    const focusColor = focusRingMatch[1];
    const bgColor = paletteVars["bg"];
    const surfaceColor = paletteVars["surface"];
    try {
      if (bgColor && !meetsAA(focusColor, bgColor, true)) {
        const ratio = contrastRatio(focusColor, bgColor);
        violations.push({
          severity: "minor",
          description: `Focus ring contrast low against bg: ${focusColor} on ${bgColor} ratio ${ratio.toFixed(1)}:1, needs 3:1`,
          suggestion: `Choose a focus ring colour with at least 3:1 contrast against the page background`,
        });
      }
      if (surfaceColor && !meetsAA(focusColor, surfaceColor, true)) {
        const ratio = contrastRatio(focusColor, surfaceColor);
        violations.push({
          severity: "minor",
          description: `Focus ring contrast low against surface: ${focusColor} on ${surfaceColor} ratio ${ratio.toFixed(1)}:1, needs 3:1`,
          suggestion: `Choose a focus ring colour with at least 3:1 contrast against the surface colour`,
        });
      }
    } catch {
      // Skip invalid hex
    }
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
