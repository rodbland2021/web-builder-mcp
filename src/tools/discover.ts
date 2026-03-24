import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const DiscoverInput = {
  businessType: z.enum(["service", "e-commerce", "hybrid", "portfolio", "research-portal"]),
  businessName: z.string(),
  location: z.string(),
  existingSiteUrl: z.string().optional(),
  competitorUrls: z.array(z.string()).optional(),
  logoUrl: z.string().optional(),
  logoFile: z.string().optional(),
  mockups: z.array(z.string()).optional(),
  targetAudience: z.string().optional(),
  products: z.string().optional(),
};

const BASE_QUESTIONS = [
  "What products or services do you offer, and which are your most important to highlight?",
  "Who is your primary target audience (age, location, interests, pain points)?",
  "What makes you different from competitors — your key differentiators?",
  "Do you have brand colours, fonts, or style guidelines? (Please share any existing brand assets.)",
  "What is the primary action you want visitors to take on your site (e.g. contact, book, buy, sign up)?",
];

const SERVICE_QUESTIONS = [
  "What are your business hours, and do you want a booking or contact form?",
  "Do you offer online booking, or is enquiry-based contact sufficient?",
  "What geographic area do you service — local, regional, national, or international?",
  "Do you have existing customer testimonials or case studies we can feature?",
  "Do you offer emergency or after-hours services that should be prominently displayed?",
];

const ECOMMERCE_QUESTIONS = [
  "How many products do you have, and do you need product categories or filtering?",
  "Do you have professional product photos ready, or will photography be needed?",
  "What product categories do you sell, and are there featured or seasonal collections?",
  "What shipping methods and regions do you support?",
  "What payment methods do you want to accept (card, PayPal, Afterpay, etc.)?",
  "Do you offer subscriptions, bundles, or recurring purchases?",
];

const HYBRID_QUESTIONS = [
  "How many products do you carry alongside your services?",
  "Should the online store and service booking be integrated, or separate sections?",
  "Do you have product photos ready, or is photography needed?",
  "What payment methods do you want to accept (card, PayPal, Afterpay, etc.)?",
  "Do you offer service packages that include physical products?",
];

const PORTFOLIO_QUESTIONS = [
  "How many projects or works do you want to showcase?",
  "Do you want case studies with full write-ups, or primarily visual galleries?",
  "What file formats are your portfolio assets in (images, video, PDFs)?",
  "Should visitors be able to filter portfolio items by category or medium?",
];

const RESEARCH_PORTAL_QUESTIONS = [
  "Who are the intended users — public researchers, internal staff, or members only?",
  "What types of content will be published (studies, datasets, articles, reports)?",
  "Is search and filtering of research content required?",
  "Do you need user accounts, access tiers, or gating for certain content?",
];

type DiscoverInputType = {
  businessType: "service" | "e-commerce" | "hybrid" | "portfolio" | "research-portal";
  businessName: string;
  location: string;
  existingSiteUrl?: string;
  competitorUrls?: string[];
  logoUrl?: string;
  logoFile?: string;
  mockups?: string[];
  targetAudience?: string;
  products?: string;
};

export function generateDiscoveryQuestions(input: DiscoverInputType): {
  businessType: string;
  questions: string[];
  flaggedAssets: string[];
} {
  const questions: string[] = [...BASE_QUESTIONS];

  switch (input.businessType) {
    case "service":
      questions.push(...SERVICE_QUESTIONS);
      break;
    case "e-commerce":
      questions.push(...ECOMMERCE_QUESTIONS);
      break;
    case "hybrid":
      questions.push(...HYBRID_QUESTIONS);
      break;
    case "portfolio":
      questions.push(...PORTFOLIO_QUESTIONS);
      break;
    case "research-portal":
      questions.push(...RESEARCH_PORTAL_QUESTIONS);
      break;
  }

  if (input.existingSiteUrl) {
    questions.push(
      `You have an existing site at ${input.existingSiteUrl} — what do you like about it and what do you want to change?`
    );
  }

  if (input.competitorUrls && input.competitorUrls.length > 0) {
    questions.push(
      `We've noted ${input.competitorUrls.length} competitor site(s) — what do you like or dislike about their web presence?`
    );
  }

  const flaggedAssets: string[] = [];

  if (!input.logoUrl && !input.logoFile) {
    flaggedAssets.push("logo creation needed");
  }

  if (input.businessType === "e-commerce" && !input.products) {
    flaggedAssets.push("product catalogue needed");
  }

  return {
    businessType: input.businessType,
    questions,
    flaggedAssets,
  };
}

export function registerDiscover(server: McpServer): void {
  server.registerTool(
    "discover",
    {
      description:
        "Comprehensive client intake — generates tailored discovery questions based on business type, analyses competitors, identifies missing assets",
      inputSchema: DiscoverInput,
    },
    async (args) => {
      const result = generateDiscoveryQuestions(args as DiscoverInputType);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
