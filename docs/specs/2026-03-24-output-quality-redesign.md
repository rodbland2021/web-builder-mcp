# Output Quality Redesign — Real Images, Rich Content, Professional Templates

**Goal:** Upgrade the web-builder-mcp output from generic template quality to Snow Country Auto / Equistry quality — full-bleed hero images, AI-generated product photos, agent-written content, proper colour palettes, trust badges, and visual depth.

**Problem:** The current build tools produce sites that pass quality gates (11/11 review, full SEO audit, zero ADA violations) but look like default Bootstrap templates. No hero images, emoji product placeholders, generic copy ("Expert service", "Reliable results"), light theme only. Not something a freelancer could charge a client for.

**Quality bar:** A generated site must look like it could sit next to Snow Country Auto (https://snow-country-auto.pages.dev) and Equistry (https://equistry.pages.dev).

---

## 1. Image Generation Pipeline

### Provider: Gemini 2.5 Flash (Nano Banana 2)

- **Package:** `@google/generative-ai`
- **Cost:** ~$0.039 per 1024x1024 image
- **Model:** `gemini-2.5-flash` with image generation capability

### Config addition

```json
{
  "google": { "apiKey": "AIza..." },
  "unsplash": { "accessKey": "..." }
}
```

### Fallback chain

1. **Google API key present** → Gemini 2.5 Flash (best quality)
2. **No Google key, Unsplash key present** → Unsplash search API (free, attribution required in footer)
3. **Neither key** → branded SVG placeholders using site palette colours. Tool warns agent to set up an API key.

### New module: `src/tools/image-generator.ts`

Shared module used by build_site, add_shop, add_booking. Exports:
- `generateImage(prompt, outputPath, config)` → generates and saves image
- `searchUnsplash(query, outputPath, config)` → downloads stock photo
- `generateSvgPlaceholder(text, palette, outputPath)` → creates branded SVG

### Cost transparency

Tool responses include image generation stats:
```json
{
  "imagesGenerated": 7,
  "imageProvider": "gemini-2.5-flash",
  "estimatedImageCost": "$0.27"
}
```

---

## 2. Redesigned `build_site` Input Schema

The AI agent is the content writer and colour designer. The tool is the renderer.

### Input

```typescript
{
  // Required
  businessName: string,
  businessType: "service" | "e-commerce" | "hybrid" | "portfolio" | "research-portal",
  location: string,
  outputDir: string,

  // Content — agent writes from discovery data
  hero: {
    headline: string,
    tagline: string,
    cta: { text: string, href: string },
    secondaryCta?: { text: string, href: string },
    imagePrompt?: string,     // → auto-generates hero via Gemini
  },
  services?: Array<{
    name: string,
    description: string,
    iconPrompt?: string,      // → generates service icon
  }>,
  about?: {
    story: string,
    mission?: string,
    teamDescription?: string,
  },
  trustBadges?: string[],
  contactInfo?: {
    phone?: string,           // shown in nav bar
    email?: string,
    address?: string,
    hours?: string,
  },

  // Visual — agent designs palette following colour theory
  palette: {
    bg: string,
    bgAlt: string,
    text: string,
    textMuted: string,
    primary: string,
    primaryDark: string,
    accent: string,
    surface: string,
    border: string,
  },
  fontFamily?: string,
  lang?: string,
}
```

### Colour palette guidance in tool description

The MCP tool description includes colour theory rules so the calling agent follows them:
- Colour wheel approach: complementary, analogous, or triadic combinations
- Dark theme: bg 900-950, text 100-200, surface 800
- Light theme: bg white/50, text 800-900
- Accent pops against both bg and surface
- primaryDark is primary darkened ~15-20% for hover states
- WCAG AA contrast ratios enforced (4.5:1 body, 3:1 large text)
- Industry conventions when no brand colours provided (blue = trust, green = health, amber = warmth, dark = automotive/premium)

---

## 3. Template Output — What "Done" Looks Like

### Layout requirements

- Full-bleed hero image with dark overlay for text contrast
- Navigation: logo, page links, phone number (if provided), prominent CTA button
- Trust badges as pills below hero CTAs
- Service/feature cards with AI-generated icons
- Sections alternate bg/bgAlt for visual rhythm
- CTA section with coloured/dark background before footer
- Footer with business info, quick links, hours

### Visual depth

- Hero fills viewport above the fold
- Cards have subtle shadows (`box-shadow`) and hover lift transitions
- Buttons have hover colour transitions
- Images throughout — not just the hero
- Alternating section backgrounds create visual rhythm

### Pages generated

- `index.html` — hero + trust badges + services + about teaser + CTA
- `about.html` — hero image + story + mission
- `contact.html` — contact info + form + business hours + address
- `styles.css` — full palette, dark/light support, all component styles
- `site.js` — nav, overlays, scroll animations, copyright year
- `robots.txt` + `sitemap.xml`
- `images/` — hero, service icons, about photo (all AI-generated)

---

## 4. Redesigned `add_shop` — Real Product Images

### Input (simplified)

```typescript
{
  siteDir: string,
  products: Array<{
    name: string,
    price: number,
    description?: string,
    tags?: string[],
  }>,
  currency?: string,
}
```

No `image` field. Every product gets an AI-generated product photo automatically.

### Image generation per product

Prompt built from product data: `"Professional product photo of {name} — {description}. Clean white background, studio lighting, commercial product photography style"`

Images saved as `images/product-{id}.jpg`.

### Cost

5 products × $0.039 = ~$0.20 per shop setup.

---

## 5. What Changes vs What Stays

### Stays the same
- MCP server architecture, tool registration, stdio transport
- Config system (extended with google + unsplash keys)
- Quality gate tools (review_site, seo_audit, ada_check)
- Deploy, screenshot, lighthouse, run_tests tools
- discover, research, create_doc, review_doc tools
- XSS escaping, pre-commit hooks, CI pipeline
- All 97 existing unit tests continue to pass

### Changes

| Component | Current | New |
|-----------|---------|-----|
| `generate_image` | Stub | Real Gemini 2.5 Flash + Unsplash fallback + SVG fallback |
| `build_site` input | 6 fields | Rich structured sections: hero, services, about, trustBadges, contactInfo, full palette |
| `build_site` output | Generic template, CSS gradient, emojis, boilerplate | Full-bleed hero, real content, generated icons, trust badges, phone in nav, alternating sections |
| `add_shop` products | Emoji placeholders | AI-generated product photos |
| `templates.ts` | Basic light theme | Full palette support, hero overlay, badges, section alternation, hover states |
| `config.json` | cloudflare + stripe + defaults | + google.apiKey + unsplash.accessKey |
| Tool descriptions | Basic | Colour theory rules, image prompt guidelines |

### New files
- `src/tools/image-generator.ts` — shared Gemini/Unsplash/SVG module

### New dependency
- `@google/generative-ai`

### Test strategy
- Image generation is mockable via an `imageProvider` option
- Unit tests use mock provider (no real API calls)
- Integration test uses mock provider
- Manual smoke test with real Gemini key validates actual image quality

---

## 6. Cost Summary for Students

| Site type | Images | Gemini cost | Unsplash cost |
|-----------|--------|-------------|---------------|
| Basic service site | ~5 (hero, 3 service icons, about) | ~$0.20 | $0.00 |
| Service + shop (5 products) | ~10 | ~$0.39 | $0.00 |
| Full hybrid (shop + booking) | ~12 | ~$0.47 | $0.00 |

Course messaging: "Your first site build costs less than fifty cents in AI images. A $2,000 client project uses under a dollar."

---

## 7. Implementation Details (from spec review)

### 7.1 Image provider injection (mockability)

All tools that generate images accept an optional `imageProvider` parameter:

```typescript
interface ImageProvider {
  generate(prompt: string, outputPath: string): Promise<string>; // returns saved file path
}

// Real provider (production)
const geminiProvider: ImageProvider = { generate: (p, o) => generateWithGemini(p, o, config) };

// Mock provider (tests)
const mockProvider: ImageProvider = { generate: (p, o) => { writeFileSync(o, svgPlaceholder); return o; } };

// Usage
buildSite(input, { imageProvider: mockProvider }); // tests
buildSite(input, { imageProvider: geminiProvider }); // production
```

Tool registration wires the real provider from config:
```typescript
export function registerBuildSite(server: McpServer, config: Config): void {
  const provider = createImageProvider(config); // picks Gemini/Unsplash/SVG based on keys
  server.registerTool("build_site", { ... }, async (args) => {
    return buildSite(args, { imageProvider: provider });
  });
}
```

### 7.2 Config schema changes (`types.ts`)

Add to ConfigSchema:
```typescript
google: z.object({
  apiKey: z.string().default(""),
}).default({}),
unsplash: z.object({
  accessKey: z.string().default(""),
}).default({}),
```

### 7.3 Config → tool wiring (`server.ts`)

`createServer()` loads config and passes it to tool registrars:

```typescript
export async function createServer(): Promise<McpServer> {
  const config = await loadConfig();
  const server = new McpServer({ name: "web-builder-mcp", version: "0.1.0" });
  registerAllTools(server, config);
  return server;
}
```

`registerAllTools(server, config)` passes config to each tool registrar. Tools that need image generation create their provider from config.

Note: `createServer()` becomes async (was sync). `index.ts` already awaits server.connect(), so the change is: `const server = await createServer();`

### 7.4 `generateStyles()` new signature

```typescript
interface Palette {
  bg: string;
  bgAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  accent: string;
  surface: string;
  border: string;
}

function generateStyles(palette: Palette, fontFamily?: string): string
```

Maps palette fields to CSS custom properties:
```css
:root {
  --color-bg: ${palette.bg};
  --color-bg-alt: ${palette.bgAlt};
  --color-text: ${palette.text};
  --color-text-muted: ${palette.textMuted};
  --color-primary: ${palette.primary};
  --color-primary-dark: ${palette.primaryDark};
  --color-accent: ${palette.accent};
  --color-surface: ${palette.surface};
  --color-border: ${palette.border};
}
```

New CSS classes added:
- `.hero` — `min-height: calc(100vh - var(--nav-height))`, background-image, background-size cover
- `.hero-overlay` — `position: absolute`, `background: rgba(0,0,0,0.55)` for text contrast
- `.trust-badges` — `display: flex`, `gap: 0.75rem`, `flex-wrap: wrap`, `justify-content: center`
- `.trust-badge` — pill shape, `border: 1px solid`, `border-radius: 999px`, `padding: 0.25rem 1rem`
- `.section-alt` — uses `var(--color-bg-alt)` background for alternating rhythm
- `.nav-phone` — phone number in nav, hidden on mobile, `font-weight: 600`
- `.footer-grid` — multi-column footer: business info, quick links, hours

### 7.5 `generateHtmlPage()` changes

New options:
```typescript
interface HtmlPageOpts {
  // existing
  title: string;
  bodyContent: string;
  lang?: string;
  canonicalUrl?: string;
  // new
  palette?: Palette;
  fontFamily?: string;
  businessName?: string;
  navLinks?: Array<{ text: string; href: string }>;
  phone?: string;           // shown in nav
  ctaButton?: { text: string; href: string }; // nav CTA button
  footerContent?: string;   // multi-column footer HTML
  unsplashAttribution?: string; // "Photo by X on Unsplash" — injected in footer
}
```

### 7.6 Unsplash attribution format

When Unsplash images are used, the footer includes:
```html
<p class="photo-credit">Photos by <a href="{photographer_url}">{photographer_name}</a> on <a href="https://unsplash.com">Unsplash</a></p>
```

### 7.7 Hero fallback without API keys

1. Gemini key present → AI-generated hero image as `images/hero.jpg`
2. Unsplash key present → stock photo from Unsplash, saved as `images/hero.jpg`
3. Neither key → CSS gradient fallback using palette colours (`linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))`). Tool response includes warning: `"warning": "No image API key configured. Hero uses CSS gradient. Add google.apiKey to ~/.web-builder-mcp/config.json for AI-generated images."`

### 7.8 Service icon fallback

If `services[].iconPrompt` is absent, auto-generate prompt: `"Simple flat icon representing {service.name}, minimal line art, single colour, transparent background"`

### 7.9 Image file naming

```
images/
├── hero.jpg              # build_site hero
├── about.jpg             # build_site about page
├── service-{slug}.jpg    # build_site service icons
└── product-{slug}.jpg    # add_shop product photos
```

`{slug}` is the name lowercased, spaces → hyphens, non-alphanumeric stripped.

### 7.10 LD+JSON image fields

Generated structured data includes image references:
```json
{ "@type": "LocalBusiness", "image": "images/hero.jpg", ... }
```

Product LD+JSON includes product images:
```json
{ "@type": "Product", "image": "images/product-house-blend-beans.jpg", ... }
```

### 7.11 `add_booking` and `add_contact` changes

- **add_booking:** Hero section gets an AI-generated image if imageProvider available (prompt: "Modern booking appointment scheduling for {businessName}"). Otherwise CSS gradient. No other changes.
- **add_contact:** No image changes. Already uses the site's existing palette and template.

### 7.12 Existing test migration

The old `build_site` tests use the 6-field schema (`businessName`, `businessType`, `location`, `outputDir`, `primaryColor`, `fontFamily`). These are **rewritten** to use the new schema with a mock imageProvider. The old fields (`primaryColor`, `fontFamily`, `tagline`) are removed — no backward compatibility shim. This is a pre-1.0 project; breaking changes are expected.

New test cases for `image-generator.ts`:
- `generateImage` with mock writes file to output path
- Falls back to Unsplash when google.apiKey is empty
- Falls back to SVG when both keys are empty
- SVG placeholder contains palette primary colour
- `createImageProvider(config)` returns correct provider type based on config keys

Integration test updated to use new `build_site` schema with mock imageProvider.

### 7.13 Cost field for free providers

When using Unsplash or SVG fallback:
```json
{ "imagesGenerated": 7, "imageProvider": "unsplash", "estimatedImageCost": "$0.00" }
{ "imagesGenerated": 7, "imageProvider": "svg-placeholder", "estimatedImageCost": "$0.00" }
```

The `estimatedImageCost` field is always present in tool responses.
