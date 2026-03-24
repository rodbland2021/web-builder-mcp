import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const ScreenshotInput = {
  url: z.string().describe("URL to capture"),
  width: z.number().optional().default(1280).describe("Viewport width in pixels"),
  height: z.number().optional().default(800).describe("Viewport height in pixels"),
  mobile: z.boolean().optional().describe("Use mobile viewport preset (375×812)"),
};

export interface ScreenshotResult {
  status: "stub";
  message: string;
  url: string;
  viewport: { width: number; height: number };
}

type ScreenshotInput = {
  url: string;
  width?: number;
  height?: number;
  mobile?: boolean;
};

export function takeScreenshot(input: ScreenshotInput): ScreenshotResult {
  const width = input.mobile ? 375 : (input.width ?? 1280);
  const height = input.mobile ? 812 : (input.height ?? 800);

  return {
    status: "stub",
    message:
      "Screenshot tool requires Playwright. Use your agent's built-in screenshot capability or install playwright as a dependency.",
    url: input.url,
    viewport: { width, height },
  };
}

export function registerScreenshot(server: McpServer): void {
  server.registerTool(
    "screenshot",
    {
      description:
        "Captures a page screenshot. Sprint 1 stub — returns instructions to use agent screenshot capability or install Playwright.",
      inputSchema: ScreenshotInput,
    },
    async (args) => {
      const input = args as ScreenshotInput;
      const result = takeScreenshot(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
