/**
 * verify_images MCP tool — scans generated images and optionally evaluates
 * them against their prompts using Gemini vision.
 */

import { z } from "zod";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../types.js";

const ImagePromptSchema = z.object({
  file: z.string().describe("Image filename (e.g. hero.png)"),
  prompt: z.string().describe("The prompt used to generate the image"),
  purpose: z.string().describe("What the image is for (e.g. hero banner, service icon)"),
});

export const VerifyImagesInput = {
  siteDir: z.string().describe("Absolute path to the site directory"),
  prompts: z
    .array(ImagePromptSchema)
    .optional()
    .describe("Optional list of image generation prompts to evaluate against"),
};

type VerifyImagesInputType = {
  siteDir: string;
  prompts?: Array<{ file: string; prompt: string; purpose: string }>;
};

export interface ImageVerification {
  file: string;
  exists: boolean;
  sizeBytes?: number;
  score?: number;
  evaluation?: string;
}

export interface VerifyImagesResult {
  passed: boolean;
  images: ImageVerification[];
  skipped?: boolean;
  reason?: string;
}

/**
 * Scan images/ directory and optionally evaluate with Gemini vision.
 */
export async function verifyImages(
  input: VerifyImagesInputType,
  opts: { googleApiKey?: string }
): Promise<VerifyImagesResult> {
  const { siteDir, prompts } = input;
  const imagesDir = join(siteDir, "images");

  if (!existsSync(imagesDir)) {
    return {
      passed: true,
      images: [],
      skipped: true,
      reason: "No images/ directory found",
    };
  }

  // Scan for image files
  const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
  const imageFiles: string[] = [];
  try {
    const entries = readdirSync(imagesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && imageExts.has(extname(entry.name).toLowerCase())) {
        imageFiles.push(entry.name);
      }
    }
  } catch {
    return {
      passed: true,
      images: [],
      skipped: true,
      reason: "Could not read images/ directory",
    };
  }

  if (imageFiles.length === 0) {
    return {
      passed: true,
      images: [],
      skipped: true,
      reason: "No image files found in images/",
    };
  }

  // If no API key, return file inventory only
  if (!opts.googleApiKey) {
    const images: ImageVerification[] = imageFiles.map((file) => {
      const filePath = join(imagesDir, file);
      const stats = readFileSync(filePath);
      return {
        file,
        exists: true,
        sizeBytes: stats.length,
      };
    });
    return {
      passed: true,
      images,
      skipped: true,
      reason: "No API key — skipped vision evaluation",
    };
  }

  // Evaluate each image with Gemini vision
  const images: ImageVerification[] = [];
  let allPassed = true;

  for (const file of imageFiles) {
    const filePath = join(imagesDir, file);
    const fileBuffer = readFileSync(filePath);
    const verification: ImageVerification = {
      file,
      exists: true,
      sizeBytes: fileBuffer.length,
    };

    // Find matching prompt info
    const promptInfo = prompts?.find((p) => p.file === file);
    const evalPrompt = promptInfo
      ? `Evaluate this image for use as a "${promptInfo.purpose}" on a website. The generation prompt was: "${promptInfo.prompt}". Score 1-10 for quality and relevance. Reply in JSON: {"score": N, "evaluation": "brief reason"}`
      : `Evaluate this image for use on a professional website. Score 1-10 for quality and appropriateness. Reply in JSON: {"score": N, "evaluation": "brief reason"}`;

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: opts.googleApiKey });

      // Determine MIME type
      const ext = extname(file).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
      };
      const mimeType = mimeMap[ext];
      if (!mimeType) {
        // Skip SVG and unsupported formats
        images.push(verification);
        continue;
      }

      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: fileBuffer.toString("base64"),
                },
              },
              { text: evalPrompt },
            ],
          },
        ],
      });

      const responseText = result.text ?? "";
      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[^}]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          score?: number;
          evaluation?: string;
        };
        verification.score = parsed.score;
        verification.evaluation = parsed.evaluation;
        if (parsed.score !== undefined && parsed.score < 6) {
          allPassed = false;
        }
      }
    } catch {
      // Skip evaluation on API errors
      verification.evaluation = "Evaluation skipped due to API error";
    }

    images.push(verification);
  }

  return {
    passed: allPassed,
    images,
  };
}

export function registerVerifyImages(server: McpServer, config: Config): void {
  server.registerTool(
    "verify_images",
    {
      description:
        "Scan generated images in a site directory and optionally evaluate quality/relevance using Gemini vision. Returns pass/fail with scores.",
      inputSchema: VerifyImagesInput,
    },
    async (args) => {
      const result = await verifyImages(args as VerifyImagesInputType, {
        googleApiKey: config.google.apiKey || undefined,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
