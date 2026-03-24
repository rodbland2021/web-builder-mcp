#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createServer from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
    console.error("web-builder-mcp server running on stdio");
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
