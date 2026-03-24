import { z } from "zod";
import { join } from "path";
import { tmpdir } from "os";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../types.js";
import { createImageProvider } from "./image-generator.js";

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
  filePath: string;
  enhancedPrompt: string;
  style: string;
  dimensions: { width: number; height: number };
  provider: string;
  estimatedCost: string;
}

type GenerateImageInputType = {
  prompt: string;
  style?: string;
  width?: number;
  height?: number;
  outputPath?: string;
};

export async function generateImage(
  input: GenerateImageInputType,
  opts: { imageProvider: { name: string; generate(prompt: string, outputPath: string): Promise<string> } }
): Promise<GenerateImageResult> {
  const {
    prompt,
    style = "modern",
    width = 1200,
    height = 630,
    outputPath,
  } = input;
  const { imageProvider } = opts;

  const modifier = STYLE_MODIFIERS[style] ?? STYLE_MODIFIERS["modern"];
  const enhancedPrompt = `${prompt}. Style: ${modifier}. High quality, professional, ${width}x${height}px.`;

  const savePath = outputPath ?? join(tmpdir(), `generate-image-${Date.now()}.jpg`);

  await imageProvider.generate(enhancedPrompt, savePath);

  const estimatedCost = imageProvider.name === "gemini-2.5-flash" ? "~$0.04" : "$0.00";

  return {
    filePath: savePath,
    enhancedPrompt,
    style,
    dimensions: { width, height },
    provider: imageProvider.name,
    estimatedCost,
  };
}

export function registerGenerateImage(server: McpServer, config: Config): void {
  const provider = createImageProvider(config);
  server.registerTool(
    "generate_image",
    {
      description:
        "Generate an image using the configured AI provider (Gemini, Unsplash, or SVG fallback). Enhances your prompt with style directives and saves the image to the specified path.",
      inputSchema: GenerateImageInput,
    },
    async (args) => {
      const input = args as GenerateImageInputType;
      const result = await generateImage(input, { imageProvider: provider });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
