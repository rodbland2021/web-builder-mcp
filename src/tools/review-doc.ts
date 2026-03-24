import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ReviewDocInput = {
  content: z.string().describe("The project document markdown content to review"),
};

type Severity = "error" | "warning" | "info";

interface ReviewIssue {
  number: number;
  severity: Severity;
  description: string;
  suggestion: string;
}

interface ReviewResult {
  passed: boolean;
  issues: ReviewIssue[];
}

const REQUIRED_SECTIONS: Array<{ heading: string; severity: Severity; suggestion: string }> = [
  {
    heading: "Overview",
    severity: "error",
    suggestion: "Add an ## Overview section with business name, type, and location.",
  },
  {
    heading: "Sitemap",
    severity: "error",
    suggestion: "Add a ## Sitemap section listing all pages the site will include.",
  },
  {
    heading: "Design System",
    severity: "error",
    suggestion: "Add a ## Design System section with brand colours, typography, and spacing.",
  },
  {
    heading: "Components",
    severity: "warning",
    suggestion: "Add a ## Components section listing all UI components needed.",
  },
  {
    heading: "Content Plan",
    severity: "warning",
    suggestion: "Add a ## Content Plan section describing content needed for each page.",
  },
  {
    heading: "Technical Requirements",
    severity: "warning",
    suggestion: "Add a ## Technical Requirements section covering hosting, APIs, and structured data.",
  },
  {
    heading: "Deployment",
    severity: "info",
    suggestion: "Add a ## Deployment section with Cloudflare Pages project name and build config.",
  },
];

/**
 * Checks whether a heading exists in the document AND has content after it
 * (i.e. at least one non-empty line before the next ## heading or end of doc).
 */
function sectionHasContent(content: string, heading: string): boolean {
  const headingPattern = new RegExp(`##\\s+${heading}`, "i");
  const match = headingPattern.exec(content);
  if (!match) return false;

  // Extract text after this heading until the next ## heading or end of string
  const afterHeading = content.slice(match.index + match[0].length);
  const nextHeadingIndex = afterHeading.search(/\n##\s+/);
  const sectionBody = nextHeadingIndex === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIndex);

  // Check for at least one non-empty, non-whitespace line
  return sectionBody.split("\n").some((line) => line.trim().length > 0);
}

export function reviewProjectDoc(content: string): ReviewResult {
  const issues: ReviewIssue[] = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!sectionHasContent(content, section.heading)) {
      issues.push({
        number: issues.length + 1,
        severity: section.severity,
        description: `Missing ${section.heading} section`,
        suggestion: section.suggestion,
      });
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

export function registerReviewDoc(server: McpServer): void {
  server.registerTool(
    "review_doc",
    {
      description:
        "Review a project document for completeness. Checks for required sections (Overview, Sitemap, Design System, Components, Content Plan, Technical Requirements, Deployment) and returns numbered issues with suggestions.",
      inputSchema: ReviewDocInput,
    },
    async (args) => {
      const result = reviewProjectDoc(args.content);
      const statusLine = result.passed ? "PASSED — document is complete." : `FAILED — ${result.issues.length} issue(s) found.`;

      const issueLines =
        result.issues.length > 0
          ? [
              "",
              "## Issues",
              "",
              ...result.issues.map(
                (i) =>
                  `**#${i.number} [${i.severity.toUpperCase()}]** ${i.description}\n_Suggestion:_ ${i.suggestion}`
              ),
            ]
          : [];

      return {
        content: [
          {
            type: "text" as const,
            text: [`# Project Document Review`, "", statusLine, ...issueLines, "", "---", "", JSON.stringify(result, null, 2)].join(
              "\n"
            ),
          },
        ],
      };
    }
  );
}
