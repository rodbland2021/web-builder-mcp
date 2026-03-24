import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const CreateDocInput = {
  businessName: z.string().describe("Business name"),
  businessType: z
    .enum(["service", "e-commerce", "hybrid", "portfolio", "research-portal"])
    .describe("Type of business"),
  location: z.string().describe("Business location e.g. 'Melbourne, VIC'"),
  services: z.string().optional().describe("Main services or products offered"),
  targetAudience: z.string().optional().describe("Target audience description"),
  brandColours: z.string().optional().describe("Brand colours as comma-separated hex codes e.g. '#2563eb, #0f172a'"),
  logoUrl: z.string().optional().describe("URL to existing logo file"),
  competitorInsights: z.string().optional().describe("Competitor insights from the research tool"),
  additionalNotes: z.string().optional().describe("Any additional notes or requirements"),
};

type BusinessType = "service" | "e-commerce" | "hybrid" | "portfolio" | "research-portal";

interface CreateDocInputType {
  businessName: string;
  businessType: BusinessType;
  location: string;
  services?: string;
  targetAudience?: string;
  brandColours?: string;
  logoUrl?: string;
  competitorInsights?: string;
  additionalNotes?: string;
}

function getSitemapPages(businessType: BusinessType): string[] {
  const common = ["Home", "About", "Contact"];
  switch (businessType) {
    case "service":
      return [...common, "Services", "Testimonials", "FAQ"];
    case "e-commerce":
      return [...common, "Shop", "Product Detail", "Cart", "Checkout", "Order Confirmation"];
    case "hybrid":
      return [...common, "Services", "Shop", "Cart", "Testimonials"];
    case "portfolio":
      return [...common, "Portfolio", "Case Studies", "Process"];
    case "research-portal":
      return [...common, "Research", "Publications", "Team", "Resources"];
  }
}

function getComponents(businessType: BusinessType): string[] {
  const common = ["Header (nav + CTA)", "Footer (links + contact)", "Hero section", "Testimonials carousel"];
  switch (businessType) {
    case "service":
      return [...common, "Services grid", "Contact form", "Booking/enquiry form", "FAQ accordion"];
    case "e-commerce":
      return [...common, "Product grid", "Shop", "Cart", "Checkout flow", "Product detail page"];
    case "hybrid":
      return [...common, "Services grid", "Product grid", "Shop", "Cart", "Contact form"];
    case "portfolio":
      return [...common, "Portfolio gallery", "Case study layout", "Process timeline"];
    case "research-portal":
      return [...common, "Research index", "Publication cards", "Search/filter", "Team profiles"];
  }
}

function getStructuredData(businessType: BusinessType, location: string): string {
  switch (businessType) {
    case "service":
    case "hybrid":
      return `LocalBusiness (${location}), Service, FAQPage`;
    case "e-commerce":
      return `Product, Offer, BreadcrumbList`;
    case "portfolio":
      return `Person/Organization, CreativeWork`;
    case "research-portal":
      return `ResearchProject, ScholarlyArticle, Organization`;
  }
}

export function generateProjectDoc(input: CreateDocInputType): string {
  const pages = getSitemapPages(input.businessType);
  const components = getComponents(input.businessType);
  const structuredData = getStructuredData(input.businessType, input.location);
  const logoLine = input.logoUrl ? `Logo: ${input.logoUrl}` : "Logo: TBD";

  const colourSection = input.brandColours
    ? `**Brand Colours:** ${input.brandColours}\n\nPrimary: ${input.brandColours.split(",")[0].trim()}\nSecondary: ${
        input.brandColours.split(",")[1]?.trim() ?? "TBD"
      }`
    : "**Brand Colours:** TBD — to be determined from research/client input\n\nPrimary: TBD\nSecondary: TBD\nAccent: TBD";

  const lines: string[] = [
    `# ${input.businessName}`,
    "",
    "## Overview",
    "",
    `**Business Name:** ${input.businessName}`,
    `**Business Type:** ${input.businessType}`,
    `**Location:** ${input.location}`,
    `**Target Audience:** ${input.targetAudience ?? "TBD"}`,
    `**Services/Products:** ${input.services ?? "TBD"}`,
    logoLine,
    "",
    "## Sitemap",
    "",
    ...pages.map((p) => `- ${p}`),
    "",
    "## Design System",
    "",
    colourSection,
    "",
    "**Typography:**",
    "- Heading: TBD",
    "- Body: TBD",
    "",
    "**Spacing:** 4px base grid",
    "",
    "## Components",
    "",
    ...components.map((c) => `- ${c}`),
    "",
    "## Content Plan",
    "",
    "**Home:** Hero, services overview, social proof, CTA",
    "**About:** Story, team, values",
    "**Contact:** Form, map, business hours",
    ...(input.businessType === "e-commerce" || input.businessType === "hybrid"
      ? ["**Shop:** Product listings, filters, featured collections"]
      : []),
    "",
    "## Technical Requirements",
    "",
    `**Structured Data:** ${structuredData}`,
    "**Hosting:** Cloudflare Pages",
    "**Forms:** Cloudflare Workers (serverless handler)",
    "**Analytics:** Cloudflare Web Analytics",
    "**Performance targets:** LCP < 2.5s, CLS < 0.1, INP < 200ms",
    "",
    ...(input.competitorInsights ? ["**Competitor Insights:**", input.competitorInsights, ""] : []),
    ...(input.additionalNotes ? ["**Additional Notes:**", input.additionalNotes, ""] : []),
    "## Deployment",
    "",
    `**Project:** ${input.businessName.toLowerCase().replace(/\s+/g, "-")}`,
    "**Platform:** Cloudflare Pages",
    "**Build command:** TBD",
    "**Output directory:** dist/",
    "**Custom domain:** TBD",
    "",
  ];

  return lines.join("\n");
}

export function registerCreateDoc(server: McpServer): void {
  server.registerTool(
    "create_doc",
    {
      description:
        "Generate a structured project document from discovery answers and research data. Produces a markdown doc covering sitemap, design system, components, content plan, and deployment.",
      inputSchema: CreateDocInput,
    },
    async (args) => {
      const doc = generateProjectDoc(args as CreateDocInputType);
      return {
        content: [
          {
            type: "text" as const,
            text: doc,
          },
        ],
      };
    }
  );
}
