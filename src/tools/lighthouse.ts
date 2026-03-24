import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export const LighthouseInput = {
  url: z.string().describe("URL to audit (must be a deployed, accessible site)"),
  mobile: z.boolean().optional().default(true).describe("Audit in mobile mode (default: true)"),
};

export interface LighthouseResult {
  status: "stub";
  message: string;
  url: string;
}

type LighthouseInputType = {
  url: string;
  mobile?: boolean;
};

export function lighthouseAudit(input: LighthouseInputType): LighthouseResult {
  return {
    status: "stub",
    message: `Lighthouse audit requires a running server. Deploy the site first, then run: npx lighthouse ${input.url} --output json`,
    url: input.url,
  };
}

export function registerLighthouse(server: McpServer): void {
  server.registerTool(
    "lighthouse",
    {
      description:
        "Performance audit via Lighthouse. Sprint 1 stub — deploy the site first then run npx lighthouse directly.",
      inputSchema: LighthouseInput,
    },
    async (args) => {
      const input = args as LighthouseInputType;
      const result = lighthouseAudit(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
