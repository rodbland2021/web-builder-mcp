import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../types.js";
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
import { registerScreenshot } from "./screenshot.js";
import { registerLighthouse } from "./lighthouse.js";
import { registerRunTests } from "./run-tests.js";
import { registerDeploy } from "./deploy.js";
import { registerGenerateImage } from "./generate-image.js";

export function registerAllTools(server: McpServer, config: Config): void {
  // Tools that don't need config
  registerDiscover(server);
  registerResearch(server);
  registerCreateDoc(server);
  registerReviewDoc(server);
  registerAddContact(server);
  registerReviewSite(server);
  registerSeoAudit(server);
  registerAdaCheck(server);
  registerScreenshot(server);
  registerLighthouse(server);
  registerRunTests(server);
  registerDeploy(server);

  // Tools that need config for image generation
  registerBuildSite(server, config);
  registerAddShop(server, config);
  registerAddBooking(server, config);
  registerGenerateImage(server, config);
}
