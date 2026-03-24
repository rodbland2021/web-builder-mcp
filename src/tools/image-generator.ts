import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Config, ImageProvider } from "../types.js";

interface NamedImageProvider extends ImageProvider {
  name: string;
}

export function createImageProvider(config: Config): NamedImageProvider {
  if (config.google.apiKey) {
    return {
      name: "imagen-4.0-fast",
      async generate(prompt: string, outputPath: string): Promise<string> {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: config.google.apiKey });
        const response = await ai.models.generateImages({
          model: "imagen-4.0-fast-generate-001",
          prompt,
          config: { numberOfImages: 1 },
        });
        if (response.generatedImages?.[0]?.image?.imageBytes) {
          mkdirSync(dirname(outputPath), { recursive: true });
          const buffer = Buffer.from(
            response.generatedImages[0].image.imageBytes as string,
            "base64"
          );
          writeFileSync(outputPath, buffer);
        }
        return outputPath;
      },
    };
  }

  if (config.unsplash.accessKey) {
    return {
      name: "unsplash",
      async generate(prompt: string, outputPath: string): Promise<string> {
        const query = encodeURIComponent(prompt.slice(0, 100));
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${query}&per_page=1`,
          {
            headers: {
              Authorization: `Client-ID ${config.unsplash.accessKey}`,
            },
          }
        );
        const data = (await res.json()) as {
          results: Array<{
            urls: { regular: string };
            user: { name: string; links: { html: string } };
          }>;
        };
        if (data.results?.[0]) {
          const imgRes = await fetch(data.results[0].urls.regular);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, buffer);
        }
        return outputPath;
      },
    };
  }

  return {
    name: "svg-placeholder",
    async generate(prompt: string, outputPath: string): Promise<string> {
      generateSvgPlaceholder(prompt, "#2563eb", outputPath);
      return outputPath;
    },
  };
}

export function generateSvgPlaceholder(
  text: string,
  primaryColor: string,
  outputPath: string
): void {
  const label = text.length > 30 ? text.slice(0, 30) + "\u2026" : text;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.8"/>
      <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0.3"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${primaryColor}" opacity="0.15"/>
  <rect x="0" y="0" width="1200" height="630" fill="url(#grad)"/>
  <text x="600" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="28" opacity="0.6">${label}</text>
</svg>`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, svg);
}

export function createMockProvider(): NamedImageProvider {
  return {
    name: "mock",
    async generate(prompt: string, outputPath: string): Promise<string> {
      generateSvgPlaceholder(prompt, "#666666", outputPath);
      return outputPath;
    },
  };
}
