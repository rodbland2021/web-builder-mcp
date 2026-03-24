import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "./config.js";
import { registerAllTools } from "./tools/index.js";

export async function createServer(): Promise<McpServer> {
  const config = await loadConfig();
  const server = new McpServer({
    name: "web-builder-mcp",
    version: "0.1.0",
  });

  registerAllTools(server, config);

  return server;
}
