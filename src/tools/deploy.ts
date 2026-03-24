import { z } from "zod";
import { existsSync, readdirSync } from "fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../config.js";
import type { Config } from "../config.js";

export const DeployInput = {
  siteDir: z.string().describe("Absolute path to directory containing built site files"),
  projectName: z.string().describe("Cloudflare Pages project name"),
  preview: z.boolean().optional().default(false).describe("Deploy to preview URL instead of production"),
};

export interface DeployResult {
  url: string;
  projectName: string;
  deploymentId: string;
  preview: boolean;
}

export interface DeployValidationResult {
  valid: boolean;
  error?: string;
}

type DeployInputType = {
  siteDir: string;
  projectName: string;
  preview?: boolean;
};

const SETUP_INSTRUCTIONS = `Cloudflare credentials are not configured. To set up:
1. Create ~/.web-builder-mcp/config.json with your CF credentials:
   {
     "cloudflare": {
       "apiKey": "your-cloudflare-api-key",
       "email": "your-cloudflare-email",
       "accountId": "your-cloudflare-account-id"
     }
   }
2. Find your credentials at: https://dash.cloudflare.com/profile/api-tokens
3. Your account ID is in the right sidebar of the Cloudflare dashboard.`;

export function validateDeployment(
  siteDir: string,
  config: Config
): DeployValidationResult {
  if (!existsSync(siteDir)) {
    return { valid: false, error: `siteDir does not exist: ${siteDir}` };
  }

  const files = readdirSync(siteDir);
  if (files.length === 0) {
    return { valid: false, error: `siteDir is empty: ${siteDir}` };
  }

  const cf = config.cloudflare;
  if (!cf.apiKey || !cf.email || !cf.accountId) {
    return { valid: false, error: SETUP_INSTRUCTIONS };
  }

  return { valid: true };
}

export async function deploy(input: DeployInputType): Promise<DeployResult | { error: string }> {
  const { siteDir, projectName, preview = false } = input;

  const config = await loadConfig();
  const validation = validateDeployment(siteDir, config);

  if (!validation.valid) {
    return { error: validation.error! };
  }

  const { apiKey, email, accountId } = config.cloudflare;
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`;

  // Check if project exists
  const checkRes = await fetch(`${baseUrl}/${projectName}`, {
    headers: {
      "X-Auth-Email": email,
      "X-Auth-Key": apiKey,
    },
  });

  // Create project if it doesn't exist
  if (checkRes.status === 404) {
    const createRes = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "X-Auth-Email": email,
        "X-Auth-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: projectName, production_branch: "main" }),
    });

    if (!createRes.ok) {
      const body = await createRes.text();
      return { error: `Failed to create CF Pages project: ${createRes.status} ${body}` };
    }
  } else if (!checkRes.ok) {
    const body = await checkRes.text();
    return { error: `Failed to check CF Pages project: ${checkRes.status} ${body}` };
  }

  // Upload deployment via direct upload API
  const formData = new FormData();
  const files = readdirSync(siteDir);
  for (const file of files) {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const content = readFileSync(join(siteDir, file));
    formData.append("files", new Blob([content]), file);
  }

  const uploadUrl = `${baseUrl}/${projectName}/deployments`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Auth-Email": email,
      "X-Auth-Key": apiKey,
    },
    body: formData,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    return { error: `Deployment upload failed: ${uploadRes.status} ${body}` };
  }

  const data = (await uploadRes.json()) as {
    result: { id: string; url: string; aliases?: string[] };
  };

  const deploymentId = data.result.id;
  const productionUrl = `https://${projectName}.pages.dev`;
  const previewUrl = data.result.url ?? productionUrl;

  return {
    url: preview ? previewUrl : productionUrl,
    projectName,
    deploymentId,
    preview,
  };
}

export function registerDeploy(server: McpServer): void {
  server.registerTool(
    "deploy",
    {
      description:
        "Deploy a built site to Cloudflare Pages using the CF REST API. Requires cloudflare credentials in ~/.web-builder-mcp/config.json.",
      inputSchema: DeployInput,
    },
    async (args) => {
      const input = args as DeployInputType;
      const result = await deploy(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
