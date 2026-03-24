import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ToolRegistrar = (server: McpServer) => void;

const toolRegistrars: ToolRegistrar[] = [];

export function registerAllTools(server: McpServer): void {
  for (const register of toolRegistrars) {
    register(server);
  }
}
