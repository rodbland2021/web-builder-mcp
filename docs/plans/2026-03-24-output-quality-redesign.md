# Output Quality Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade generated site output from generic template quality to professional quality — real AI-generated images (Gemini 2.5 Flash), rich structured content from the AI agent, full colour palette support, trust badges, and visual depth matching Snow Country Auto / Equistry.

**Architecture:** Image generation via `@google/generative-ai` SDK with Unsplash and SVG fallbacks, injected via an `ImageProvider` interface for testability. `createServer()` becomes async to load config and create the provider. `build_site` accepts rich structured input (hero, services, palette, trust badges). Templates rewritten for full palette CSS custom properties, hero images, alternating sections, and multi-column footer.

**Tech Stack:** TypeScript, `@google/genai` (Google Generative AI SDK — NOT the legacy `@google/generative-ai`), `@modelcontextprotocol/sdk` v1.27.x, Zod 3, Vitest

**CRITICAL NOTES for implementers:**
- Package is `@google/genai` (newer SDK), NOT `@google/generative-ai` (legacy). Model: `imagen-3.0-generate-002`.
- Tasks 3-5 must be implemented together in one session — `generateStyles()` signature changes in Task 4 will break `build-site.ts` until Task 5 rewrites it. Run `npx tsc --noEmit` only after Task 5, not between Tasks 4 and 5.
- `buildSite()`, `addShop()`, `addBooking()` all become async. Every call site (including integration tests) must `await` them.
- In `tools/index.ts`, remove the old `ToolRegistrar[]` array and loop. Replace with direct inline calls since signatures now differ.
- `generateHtmlPage()` currently uses `{ label: string }` in navLinks — keep `label` (not `text`) for consistency with existing callers.

**Spec:** `/home/clawdbot/repos/web-builder-mcp/docs/specs/2026-03-24-output-quality-redesign.md`

**Repo:** `/home/clawdbot/repos/web-builder-mcp/` (branch: create `feature/output-quality-redesign`)

---

## File Structure (changes only)

```
src/
├── types.ts              # MODIFY: add google + unsplash to ConfigSchema, add Palette + ImageProvider types
├── config.ts             # UNCHANGED
├── server.ts             # MODIFY: async createServer(), load config, pass to registerAllTools
├── index.ts              # MODIFY: await createServer()
├── tools/
│   ├── index.ts          # MODIFY: registerAllTools(server, config) signature
│   ├── image-generator.ts  # CREATE: Gemini/Unsplash/SVG image provider
│   ├── generate-image.ts   # REWRITE: real Gemini calls instead of stub
│   ├── templates.ts         # REWRITE: palette-based styles, hero image, badges, footer
│   ├── build-site.ts        # REWRITE: rich structured input, image generation during build
│   ├── add-shop.ts          # MODIFY: auto-generate product images
│   ├── add-booking.ts       # MODIFY: hero image for booking page
│   └── add-contact.ts       # MINOR: no image changes, palette passthrough
tests/
├── tools/
│   ├── image-generator.test.ts  # CREATE: provider tests with mocks
│   ├── templates.test.ts        # MODIFY: update for new palette signature
│   ├── build-site.test.ts       # REWRITE: new schema + mock provider
│   ├── add-shop.test.ts         # MODIFY: verify product image generation
│   └── generate-image.test.ts   # REWRITE: test real provider interface
└── integration.test.ts          # MODIFY: new schema + mock provider
```

---

### Task 1: Config Schema + Types + ImageProvider Interface

**Files:**
- Modify: `src/types.ts`
- Create: `tests/tools/image-generator.test.ts` (provider interface tests only)

- [ ] **Step 1: Write tests for the new types**

```typescript
// tests/tools/image-generator.test.ts
import { describe, it, expect } from "vitest";
import { ConfigSchema, type Palette, type ImageProvider } from "../../src/types.js";

describe("ConfigSchema", () => {
  it("includes google and unsplash fields with defaults", () => {
    const config = ConfigSchema.parse({});
    expect(config.google.apiKey).toBe("");
    expect(config.unsplash.accessKey).toBe("");
  });
});

describe("Palette type", () => {
  it("has all required colour fields", () => {
    const palette: Palette = {
      bg: "#0f172a", bgAlt: "#1e293b", text: "#e2e8f0", textMuted: "#94a3b8",
      primary: "#2563eb", primaryDark: "#1e40af", accent: "#f59e0b",
      surface: "#1e293b", border: "#334155",
    };
    expect(palette.bg).toBe("#0f172a");
    expect(Object.keys(palette)).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/tools/image-generator.test.ts
```

- [ ] **Step 3: Update src/types.ts**

Add to ConfigSchema:
```typescript
google: z.object({ apiKey: z.string().default("") }).default({}),
unsplash: z.object({ accessKey: z.string().default("") }).default({}),
```

Add new exports:
```typescript
export interface Palette {
  bg: string; bgAlt: string; text: string; textMuted: string;
  primary: string; primaryDark: string; accent: string;
  surface: string; border: string;
}

export interface ImageProvider {
  generate(prompt: string, outputPath: string): Promise<string>;
}

export interface ImageResult {
  imagesGenerated: number;
  imageProvider: string;
  estimatedImageCost: string;
}
```

- [ ] **Step 4: Run test, verify pass**
- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/tools/image-generator.test.ts
git commit -m "feat: add Palette, ImageProvider types + google/unsplash config fields"
```

---

### Task 2: Image Generator Module

**Files:**
- Create: `src/tools/image-generator.ts`
- Modify: `tests/tools/image-generator.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// Add to tests/tools/image-generator.test.ts
import { createImageProvider, generateSvgPlaceholder } from "../../src/tools/image-generator.js";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("createImageProvider", () => {
  it("returns gemini provider when google apiKey is set", () => {
    const config = ConfigSchema.parse({ google: { apiKey: "test-key" } });
    const provider = createImageProvider(config);
    expect(provider.name).toBe("gemini-2.5-flash");
  });

  it("returns unsplash provider when only unsplash key is set", () => {
    const config = ConfigSchema.parse({ unsplash: { accessKey: "test-key" } });
    const provider = createImageProvider(config);
    expect(provider.name).toBe("unsplash");
  });

  it("returns svg-placeholder provider when no keys are set", () => {
    const config = ConfigSchema.parse({});
    const provider = createImageProvider(config);
    expect(provider.name).toBe("svg-placeholder");
  });
});

describe("generateSvgPlaceholder", () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = join(tmpdir(), `svg-test-${Date.now()}`); mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

  it("creates an SVG file with palette colours", () => {
    const out = join(tmpDir, "test.svg");
    generateSvgPlaceholder("Coffee shop hero", "#b45309", out);
    const svg = readFileSync(out, "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#b45309");
  });
});
```

- [ ] **Step 2: Run test, verify fail**
- [ ] **Step 3: Create src/tools/image-generator.ts**

```typescript
// src/tools/image-generator.ts
import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Config, ImageProvider } from "../types.js";

interface NamedImageProvider extends ImageProvider {
  name: string;
}

export function createImageProvider(config: Config): NamedImageProvider {
  if (config.google.apiKey) {
    return {
      name: "gemini-2.5-flash",
      async generate(prompt: string, outputPath: string): Promise<string> {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: config.google.apiKey });
        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt,
          config: { numberOfImages: 1 },
        });
        if (response.generatedImages?.[0]?.image?.imageBytes) {
          mkdirSync(dirname(outputPath), { recursive: true });
          const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, "base64");
          writeFileSync(outputPath, buffer);
        }
        return outputPath;
      },
    };
  }
  if (config.unsplash.accessKey) {
    return {
      name: "unsplash",
      async generate(prompt: string, outputPath: string): Promise<string> {
        const query = encodeURIComponent(prompt.slice(0, 100));
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${query}&per_page=1`,
          { headers: { Authorization: `Client-ID ${config.unsplash.accessKey}` } }
        );
        const data = await res.json() as { results: Array<{ urls: { regular: string }, user: { name: string, links: { html: string } } }> };
        if (data.results?.[0]) {
          const imgRes = await fetch(data.results[0].urls.regular);
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          mkdirSync(dirname(outputPath), { recursive: true });
          writeFileSync(outputPath, buffer);
        }
        return outputPath;
      },
    };
  }
  return {
    name: "svg-placeholder",
    async generate(prompt: string, outputPath: string): Promise<string> {
      generateSvgPlaceholder(prompt, "#2563eb", outputPath);
      return outputPath;
    },
  };
}

export function generateSvgPlaceholder(text: string, primaryColor: string, outputPath: string): void {
  const label = text.length > 30 ? text.slice(0, 30) + "…" : text;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:0.8"/>
    <stop offset="100%" style="stop-color:${primaryColor};stop-opacity:0.3"/>
  </linearGradient></defs>
  <rect width="1200" height="630" fill="${primaryColor}" opacity="0.15"/>
  <rect x="0" y="0" width="1200" height="630" fill="url(#grad)"/>
  <text x="600" y="330" text-anchor="middle" fill="white" font-family="system-ui" font-size="28" opacity="0.6">${label}</text>
</svg>`;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, svg);
}

export function createMockProvider(): NamedImageProvider {
  return {
    name: "mock",
    async generate(prompt: string, outputPath: string): Promise<string> {
      generateSvgPlaceholder(prompt, "#666666", outputPath);
      return outputPath;
    },
  };
}
```

Note: The actual Gemini API import and method names need verification during implementation. The implementer should check `@google/genai` docs. If the API is different, adjust the call accordingly. The key contract is: take a prompt, return image bytes, save to outputPath.

- [ ] **Step 4: Install @google/genai**

```bash
npm install @google/genai
```

- [ ] **Step 5: Run tests, verify pass**
- [ ] **Step 6: Commit**

```bash
git add src/tools/image-generator.ts tests/tools/image-generator.test.ts package.json package-lock.json
git commit -m "feat: image generator module — Gemini/Unsplash/SVG providers with mock for testing"
```

---

### Task 3: Server Wiring — Async createServer + Config

**Files:**
- Modify: `src/server.ts`
- Modify: `src/index.ts`
- Modify: `src/tools/index.ts`
- Modify: `tests/server.test.ts`

- [ ] **Step 1: Update server test**

```typescript
// tests/server.test.ts
import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("returns a defined server object", async () => {
    const server = await createServer();
    expect(server).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test, verify fail** (createServer is sync, test expects async)

- [ ] **Step 3: Update src/tools/index.ts**

Change signature to accept config:
```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../types.js";
// ... all imports ...

export function registerAllTools(server: McpServer, config: Config): void {
  // tools that don't need config
  registerDiscover(server);
  registerResearch(server);
  // ... etc ...

  // tools that need config for image generation
  registerBuildSite(server, config);
  registerAddShop(server, config);
  registerAddBooking(server, config);
  registerGenerateImage(server, config);

  // tools that don't need config
  registerAddContact(server);
  // ... etc ...
}
```

For now, pass `config` to the tools that need it. Tools that don't need config keep their existing `(server: McpServer)` signature.

- [ ] **Step 4: Update src/server.ts**

```typescript
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
```

- [ ] **Step 5: Update src/index.ts**

```typescript
#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("web-builder-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

- [ ] **Step 6: Update tool registrar signatures that need config**

For `build-site.ts`, `add-shop.ts`, `add-booking.ts`, `generate-image.ts`: change their `registerX(server)` to `registerX(server, config)`. For now, just accept the config parameter — the actual usage comes in later tasks. This ensures TypeScript compiles.

- [ ] **Step 7: Run all tests, verify pass**

```bash
npx vitest run
```

- [ ] **Step 8: Commit**

```bash
git add src/server.ts src/index.ts src/tools/index.ts tests/server.test.ts src/tools/build-site.ts src/tools/add-shop.ts src/tools/add-booking.ts src/tools/generate-image.ts
git commit -m "feat: async createServer with config loading, pass config to tools"
```

---

### Task 4: Templates Rewrite — Palette, Hero, Badges, Footer

**Files:**
- Modify: `src/tools/templates.ts`
- Modify: `tests/tools/templates.test.ts`

This is the largest task. The template system needs to support:
- Full 9-field palette via CSS custom properties
- Hero section with background image + dark overlay
- Trust badges row
- Alternating section backgrounds
- Phone number in nav
- Multi-column footer
- Hover transitions on cards and buttons

- [ ] **Step 1: Write new template tests**

Update `tests/tools/templates.test.ts` — replace the existing `generateStyles` tests with palette-based ones:

Tests needed:
- `generateStyles` includes all 9 palette CSS custom properties
- `generateStyles` includes `.hero` with `min-height` and background-image
- `generateStyles` includes `.hero-overlay`
- `generateStyles` includes `.trust-badges` and `.trust-badge`
- `generateStyles` includes `.section-alt` using `var(--color-bg-alt)`
- `generateStyles` includes `.nav-phone`
- `generateStyles` includes `.footer-grid`
- `generateStyles` includes hover transitions on `.btn` and `.feature-card`
- `generateHtmlPage` accepts `phone` and renders it in nav
- `generateHtmlPage` accepts `ctaButton` and renders nav CTA
- `generateHtmlPage` accepts `footerContent` and renders multi-column footer
- `generateHtmlPage` renders unsplash attribution when provided

- [ ] **Step 2: Run tests, verify fail**
- [ ] **Step 3: Rewrite generateStyles(palette, fontFamily)**

Change the signature from `(opts: StylesOpts)` to `(palette: Palette, fontFamily?: string)`.

Map all 9 palette fields to CSS custom properties. Keep all existing CSS classes but update them to use the new variable names. Add new classes: `.hero`, `.hero-overlay`, `.trust-badges`, `.trust-badge`, `.section-alt`, `.nav-phone`, `.footer-grid`, `.footer-col`.

The CSS should produce sites that look like Snow Country / Equistry — dark or light depending on palette values.

- [ ] **Step 4: Update generateHtmlPage(opts)**

Expand `HtmlPageOpts`:
- `phone?: string` — rendered as `<a href="tel:" class="nav-phone">` in the nav
- `ctaButton?: { text: string; href: string }` — rendered as a button in the nav
- `footerContent?: string` — multi-column footer HTML (replaces single-line copyright)
- `unsplashAttribution?: string` — photo credit line in footer
- `heroContent?: string` — replaces generic body content injection for full-bleed hero

- [ ] **Step 5: Run tests, verify pass**
- [ ] **Step 6: Commit**

```bash
git add src/tools/templates.ts tests/tools/templates.test.ts
git commit -m "feat: templates rewrite — full palette, hero image, trust badges, multi-column footer"
```

---

### Task 5: build_site Rewrite — Rich Structured Input

**Files:**
- Modify: `src/tools/build-site.ts`
- Modify: `tests/tools/build-site.test.ts`

- [ ] **Step 1: Write new build_site tests**

Replace existing tests with ones that use the new schema:

Tests needed:
- Creates `images/` directory
- Creates `images/hero.jpg` (or .svg with mock provider)
- Creates index.html with hero section containing business name
- Creates index.html with trust badges when provided
- Creates index.html with service cards from input
- Creates about.html with story content from input
- Creates contact.html with phone/email/address from input
- Uses palette colours in generated CSS
- Includes LD+JSON with image field
- Returns `imagesGenerated` and `estimatedImageCost` in result
- All tests use `createMockProvider()` for image generation
- When using SVG fallback provider, result includes `warning` field about missing API key

- [ ] **Step 2: Run tests, verify fail**
- [ ] **Step 3: Rewrite build_site**

New input schema (Zod):
```typescript
{
  businessName: z.string(),
  businessType: z.enum([...]),
  location: z.string(),
  outputDir: z.string(),
  hero: z.object({
    headline: z.string(),
    tagline: z.string(),
    cta: z.object({ text: z.string(), href: z.string() }),
    secondaryCta: z.object({ text: z.string(), href: z.string() }).optional(),
    imagePrompt: z.string().optional(),
  }),
  services: z.array(z.object({
    name: z.string(),
    description: z.string(),
    iconPrompt: z.string().optional(),
  })).optional(),
  about: z.object({
    story: z.string(),
    mission: z.string().optional(),
    teamDescription: z.string().optional(),
  }).optional(),
  trustBadges: z.array(z.string()).optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
    hours: z.string().optional(),
  }).optional(),
  palette: z.object({
    bg: z.string(), bgAlt: z.string(), text: z.string(), textMuted: z.string(),
    primary: z.string(), primaryDark: z.string(), accent: z.string(),
    surface: z.string(), border: z.string(),
  }),
  fontFamily: z.string().optional(),
  lang: z.string().optional(),
}
```

`buildSite(input, opts: { imageProvider: ImageProvider })` becomes async.

During build:
1. Create `images/` dir
2. Generate hero image via provider (prompt from `hero.imagePrompt` or default)
3. Generate service icons via provider (prompt from `services[].iconPrompt` or auto)
4. Generate about page image via provider
5. Render index.html with hero (full-bleed bg image + overlay + headline + tagline + CTAs + trust badges), services section, CTA section
6. Render about.html with about content
7. Render contact.html with contact info
8. Generate styles.css from palette
9. Return result with image stats

The MCP tool description includes colour theory guidelines from the spec.

- [ ] **Step 4: Register with config**

```typescript
export function registerBuildSite(server: McpServer, config: Config): void {
  const provider = createImageProvider(config);
  server.registerTool("build_site", {
    description: "Generate a complete website... PALETTE GUIDELINES: ...",
    inputSchema: BuildSiteInput,
  }, async (args) => {
    const result = await buildSite(args, { imageProvider: provider });
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });
}
```

- [ ] **Step 5: Run tests, verify pass**
- [ ] **Step 6: Commit**

```bash
git add src/tools/build-site.ts tests/tools/build-site.test.ts
git commit -m "feat: build_site rewrite — rich structured input, AI-generated images, palette support"
```

---

### Task 6: add_shop Rewrite — Product Image Generation

**Files:**
- Modify: `src/tools/add-shop.ts`
- Modify: `tests/tools/add-shop.test.ts`

- [ ] **Step 1: Write new tests**

Tests needed:
- Creates `images/product-{slug}.jpg` for each product (using mock provider)
- Product cards reference generated images (not emojis)
- Products input has no `image` field
- Returns `imagesGenerated` count
- Existing tests updated for new schema (no `image` field)

- [ ] **Step 2: Run tests, verify fail**
- [ ] **Step 3: Update add_shop**

Remove `image` from product schema. During `addShop()`:
1. For each product, generate image via provider with prompt: `"Professional product photo of {name} — {description}. Clean white background, studio lighting, commercial product photography"`
2. Save as `images/product-{slug}.jpg`
3. Product card HTML uses `<img src="images/product-{slug}.jpg" alt="{name}">`
4. Return image stats in result

`addShop(input, opts: { imageProvider })` becomes async.

- [ ] **Step 4: Run tests, verify pass**
- [ ] **Step 5: Commit**

```bash
git add src/tools/add-shop.ts tests/tools/add-shop.test.ts
git commit -m "feat: add_shop with AI-generated product images, no more emoji placeholders"
```

---

### Task 7: add_booking Hero Image + Minor Updates

**Files:**
- Modify: `src/tools/add-booking.ts`
- Modify: `tests/tools/add-booking.test.ts`

- [ ] **Step 1: Update tests**

Add test: booking page has hero image (via mock provider).
Update existing tests for async `addBooking()`.

- [ ] **Step 2: Update add_booking**

`addBooking(input, opts: { imageProvider })` becomes async. Generates a hero image for the booking page. Everything else stays the same.

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```bash
git add src/tools/add-booking.ts tests/tools/add-booking.test.ts
git commit -m "feat: add_booking with generated hero image"
```

---

### Task 7.5: Verify add_contact.ts still compiles

**Files:** None modified — verification only

- [ ] **Step 1: Verify add_contact.ts compiles with new templates**

```bash
npx tsc --noEmit
```

`add-contact.ts` imports from `templates.js`. The `generateHtmlPage()` changes are all additive (new optional fields) so existing callers should still work. If it breaks, fix the call site to match the updated signature.

- [ ] **Step 2: Run add-contact tests**

```bash
npx vitest run tests/tools/add-contact.test.ts
```

---

### Task 8: generate_image Rewrite — Real Provider

**Files:**
- Modify: `src/tools/generate-image.ts`
- Modify: `tests/tools/generate-image.test.ts`

- [ ] **Step 1: Update tests**

Tests for the new real implementation:
- Calls provider.generate with enhanced prompt
- Returns file path when outputPath provided
- Applies style modifiers to prompt
- Returns cost estimate based on provider name

- [ ] **Step 2: Rewrite generate-image.ts**

The tool now actually generates images by calling the provider (from config). Keeps the prompt enhancement logic (style modifiers). Saves to outputPath. Returns `{ filePath, enhancedPrompt, style, dimensions, provider, estimatedCost }`.

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```bash
git add src/tools/generate-image.ts tests/tools/generate-image.test.ts
git commit -m "feat: generate_image rewrite — real Gemini API calls with provider injection"
```

---

### Task 9: Integration Test Update

**Files:**
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Rewrite integration test**

Update to use:
- New `build_site` schema with hero, services, palette, trust badges
- `createMockProvider()` for all image generation
- Verify `images/` directory created with hero and service images
- All quality gates still pass (review_site, seo_audit, ada_check)
- add_shop with mock provider, verify product images created
- add_booking with mock provider, verify hero image

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```
All tests must pass.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add tests/integration.test.ts
git commit -m "feat: integration tests updated for rich structured input + mock image provider"
```

---

### Task 10: Smoke Test — Build a Real Site

**Files:** None (manual verification)

- [ ] **Step 1: Build a site with mock provider**

```bash
cd /home/clawdbot/repos/web-builder-mcp
# Use the MCP protocol to build a site
echo '...' | npx tsx src/index.ts
```

Call `build_site` with a full Sunrise Café spec — hero, services, trust badges, amber palette. Verify the output has real images (SVG from mock), proper layout, trust badges.

- [ ] **Step 2: Deploy to CF Pages and screenshot**

```bash
npx wrangler pages deploy /tmp/sunrise-v2 --project-name sunrise-cafe-v2 --commit-dirty=true
kit screenshot "https://sunrise-cafe-v2.pages.dev" --out /tmp/
```

Compare visually to Snow Country Auto / Equistry quality bar.

- [ ] **Step 3: Run quality gates on deployed site**

Verify review_site, seo_audit, ada_check all pass.

- [ ] **Step 4: Push and update Monday**

```bash
git push -u origin feature/output-quality-redesign
```

Update Monday epic with results + screenshots.

---

## Verification Checklist

1. `npx vitest run` — all tests pass (with mock provider, no real API calls)
2. `npx tsc --noEmit` — clean
3. Integration test: build_site + add_shop + add_booking → all quality gates pass
4. Generated site has: full-bleed hero image, trust badges, service cards with icons, multi-column footer, phone in nav
5. Generated shop has: real product images (not emojis)
6. No inline styles in generated HTML
7. CSS uses palette custom properties throughout
8. LD+JSON includes image references
9. Cost stats returned in tool responses
10. Fallback chain works: Gemini → Unsplash → SVG placeholder

## What's Next After This Plan

- Smoke test with real Gemini API key (verify actual AI-generated images)
- Publish v0.1.0 to npm
- Sprint 2: `update_site` tool
