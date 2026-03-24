import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ResearchInput = {
  industry: z.string().describe("Industry/niche e.g. 'café', 'auto repair', 'dentist'"),
  competitorUrls: z.array(z.string()).optional().describe("Competitor website URLs to analyse"),
  existingSiteUrl: z.string().optional().describe("Client's current website URL"),
  targetAudience: z.string().optional().describe("Target audience description"),
};

interface CompetitorEntry {
  url: string;
  features: string[];
  gaps: string[];
  strengths: string[];
  weaknesses: string[];
}

interface ExistingSiteEntry {
  url: string;
  contentToPreserve: string[];
  improvementAreas: string[];
}

interface ResearchReport {
  industry: string;
  targetAudience: string;
  sections: string[];
  competitors: CompetitorEntry[];
  existingSite?: ExistingSiteEntry;
  audiencePainPoints: string[];
  contentPriorities: string[];
  seoOpportunities: string[];
  heroImageRecommendations: string[];
}

const RESEARCH_SECTIONS = [
  "audiencePainPoints",
  "competitorAnalysis",
  "contentPriorities",
  "seoOpportunities",
  "heroImageRecommendations",
] as const;

export function generateResearchReport(input: {
  industry: string;
  competitorUrls?: string[];
  existingSiteUrl?: string;
  targetAudience?: string;
}): ResearchReport {
  const competitors: CompetitorEntry[] = (input.competitorUrls ?? []).map((url) => ({
    url,
    features: [],
    gaps: [],
    strengths: [],
    weaknesses: [],
  }));

  const existingSite = input.existingSiteUrl
    ? { url: input.existingSiteUrl, contentToPreserve: [], improvementAreas: [] }
    : undefined;

  return {
    industry: input.industry,
    targetAudience: input.targetAudience ?? "",
    sections: [...RESEARCH_SECTIONS],
    competitors,
    existingSite,
    audiencePainPoints: [],
    contentPriorities: [],
    seoOpportunities: [],
    heroImageRecommendations: [],
  };
}

export function registerResearch(server: McpServer): void {
  server.registerTool(
    "research",
    {
      description:
        "Analyse target audience, pain points, competitors, and content priorities for a business. Returns a structured research report framework.",
      inputSchema: ResearchInput,
    },
    async (args) => {
      const result = generateResearchReport(args);
      return {
        content: [
          {
            type: "text" as const,
            text: [
              `# Market Research: ${result.industry}`,
              "",
              `**Target Audience:** ${result.targetAudience || "(to be determined from industry analysis)"}`,
              "",
              "## Sections to Complete",
              "",
              "The AI agent should analyse and fill in each section:",
              "",
              "### 1. Audience Pain Points",
              "What problems does the target audience face that this business solves?",
              "",
              "### 2. Competitor Analysis",
              ...(result.competitors.length > 0
                ? [
                    "",
                    "Competitors to analyse:",
                    ...result.competitors.map((c) => `- ${c.url}`),
                    "",
                    "For each: features offered, gaps/missing features, strengths, weaknesses",
                  ]
                : ["No competitor URLs provided — agent should identify 2-3 competitors in the local area."]),
              "",
              "### 3. Content Priorities",
              "What content matters most for this industry and audience?",
              "",
              "### 4. SEO Opportunities",
              "Local SEO, structured data, high-intent keywords for this industry",
              "",
              "### 5. Hero Image Recommendations",
              "What hero/banner images would resonate with the target audience?",
              ...(result.existingSite
                ? [
                    "",
                    "### Existing Site Analysis",
                    `URL: ${result.existingSite.url}`,
                    "Review for: content to preserve, brand voice, imagery, areas for improvement",
                  ]
                : []),
              "",
              "---",
              "",
              JSON.stringify(result, null, 2),
            ].join("\n"),
          },
        ],
      };
    }
  );
}
