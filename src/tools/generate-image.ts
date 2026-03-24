import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const GenerateImageInput = {
  prompt: z.string().describe("Description of the image to generate"),
  style: z.string().optional().default("modern").describe(
    'Visual style directive: "modern", "minimal", "luxury", "warm", "corporate"'
  ),
  width: z.number().optional().default(1200).describe("Image width in pixels"),
  height: z.number().optional().default(630).describe("Image height in pixels"),
  outputPath: z.string().optional().describe("File path to save the generated image"),
};

const STYLE_MODIFIERS: Record<string, string> = {
  modern: "Clean, contemporary design with bold typography and generous whitespace",
  minimal: "Minimalist aesthetic, limited color palette, elegant simplicity",
  luxury: "Premium, sophisticated, rich colors, polished surfaces",
  warm: "Warm lighting, inviting atmosphere, earth tones",
  corporate: "Professional, trustworthy, clean lines, brand-appropriate",
};

export interface GenerateImageResult {
  enhancedPrompt: string;
  style: string;
  dimensions: { width: number; height: number };
  outputPath: string | null;
  instructions: string;
}

type GenerateImageInputType = {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  outputPath?: string;
};

export function generateImagePrompt(input: GenerateImageInputType): GenerateImageResult {
  const {
    prompt,
    style = "modern",
    width = 1200,
    height = 630,
    outputPath,
  } = input;

  const modifier = STYLE_MODIFIERS[style] ?? STYLE_MODIFIERS["modern"];
  const enhancedPrompt = `${prompt}. Style: ${modifier}. High quality, professional, ${width}x${height}px.`;

  return {
    enhancedPrompt,
    style,
    dimensions: { width, height },
    outputPath: outputPath ?? null,
    instructions:
      "Use your AI agent's image generation capability with the enhanced prompt above. Save the result to the outputPath if specified.",
  };
}

export function registerGenerateImage(server: McpServer): void {
  server.registerTool(
    "generate_image",
    {
      description:
        "Structured image generation stub — enhances your prompt with style directives and returns instructions for the calling AI agent to generate the image using its own capabilities.",
      inputSchema: GenerateImageInput,
    },
    async (args) => {
      const input = args as GenerateImageInputType;
      const result = generateImagePrompt(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
