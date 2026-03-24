import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDiscover } from "./discover.js";
import { registerResearch } from "./research.js";
import { registerCreateDoc } from "./create-doc.js";
import { registerReviewDoc } from "./review-doc.js";
import { registerBuildSite } from "./build-site.js";
import { registerAddShop } from "./add-shop.js";
import { registerAddBooking } from "./add-booking.js";
import { registerAddContact } from "./add-contact.js";
import { registerReviewSite } from "./review-site.js";
import { registerSeoAudit } from "./seo-audit.js";
import { registerAdaCheck } from "./ada-check.js";

type ToolRegistrar = (server: McpServer) => void;

const toolRegistrars: ToolRegistrar[] = [
  registerDiscover,
  registerResearch,
  registerCreateDoc,
  registerReviewDoc,
  registerBuildSite,
  registerAddShop,
  registerAddBooking,
  registerAddContact,
  registerReviewSite,
  registerSeoAudit,
  registerAdaCheck,
];

export function registerAllTools(server: McpServer): void {
  for (const register of toolRegistrars) {
    register(server);
  }
}
