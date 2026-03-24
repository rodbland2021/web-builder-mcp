import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiscover } from "./discover.js";
import { registerResearch } from "./research.js";
import { registerCreateDoc } from "./create-doc.js";
import { registerReviewDoc } from "./review-doc.js";
import { registerBuildSite } from "./build-site.js";
import { registerAddShop } from "./add-shop.js";
import { registerAddBooking } from "./add-booking.js";

type ToolRegistrar = (server: McpServer) => void;

const toolRegistrars: ToolRegistrar[] = [
  registerDiscover,
  registerResearch,
  registerCreateDoc,
  registerReviewDoc,
  registerBuildSite,
  registerAddShop,
  registerAddBooking,
];

export function registerAllTools(server: McpServer): void {
  for (const register of toolRegistrars) {
    register(server);
  }
}
