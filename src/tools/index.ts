import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiscover } from "./discover.js";

type ToolRegistrar = (server: McpServer) => void;

const toolRegistrars: ToolRegistrar[] = [registerDiscover];

export function registerAllTools(server: McpServer): void {
  for (const register of toolRegistrars) {
    register(server);
  }
}
