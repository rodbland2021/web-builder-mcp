# Visual Quality Gates — Contrast Checking + Image Validation

**Goal:** Add contrast ratio checking to `ada_check` (math-based, no API needed) and a new `verify_images` tool (Gemini vision-based) to catch the two classes of visual defects that static HTML analysis misses: unreadable text and AI image hallucinations.

**Problem:** The current quality gates pass 11/11 on a site where the booking page hero is a hallucinated calendar app screenshot and the focus ring colour doesn't match the palette. Static HTML analysis can't catch visual quality issues.

---

## 1. Contrast Ratio Checking (in `ada_check`)

### 1.1 Palette Contrast Ratios (pure math)

Parse CSS custom properties from `styles.css`. Calculate WCAG AA contrast ratios:

| Pair | Standard | Required Ratio |
|------|----------|---------------|
| `--color-text` on `--color-bg` | Body text | 4.5:1 |
| `--color-text` on `--color-bg-alt` | Alt section text | 4.5:1 |
| `--color-text` on `--color-surface` | Card text | 4.5:1 |
| `--color-primary` on `--color-bg` | Links/buttons | 4.5:1 |
| `#fff` on `--color-primary` | Button text | 4.5:1 |
| `--color-text-muted` on `--color-bg` | Muted text | 3:1 |

Formula: Relative luminance `L = 0.2126*R + 0.7152*G + 0.0722*B` (linearised sRGB). Contrast ratio = `(L_lighter + 0.05) / (L_darker + 0.05)`.

### 1.2 Hero Overlay Contrast (image pixel analysis)

Read `images/hero.png` using `pngjs`. Sample pixels, find brightest 10% (worst case). Calculate effective background after overlay (`rgba(0,0,0,0.55)`): `effective = 0.55 * 0 + 0.45 * brightest_luminance`. Check white text (#fff) contrast against effective background. Must meet 3:1 (large text — hero headings).

If hero image doesn't exist, skip.

### 1.3 Focus Ring Visibility

Parse CSS for focus ring styling. Check that the focus colour has sufficient contrast against `--color-bg` and `--color-surface`. Minimum 3:1 for UI components per WCAG 2.1 SC 1.4.11.

### Dependencies

- `pngjs` (~50KB) for PNG pixel reading

---

## 2. `verify_images` — New Tool (#17)

### Input

```typescript
{
  siteDir: string,
  prompts?: Array<{
    file: string,
    prompt: string,
    purpose: "hero" | "service-icon" | "product" | "booking-hero" | "about",
  }>
}
```

If `prompts` omitted, infer purpose from filenames.

### How it works

For each image in `images/`:
1. Send to Gemini vision with structured evaluation prompt
2. Score 1-10 for appropriateness
3. Flag below 6 as failure
4. Check for: AI hallucinations, UI mockups, text/watermark artifacts, wrong subject matter

### Return

```typescript
{
  passed: boolean,
  images: Array<{ file: string, score: number, pass: boolean, issues: string[] }>,
  skipped?: boolean,  // true when no Google API key
}
```

### Cost

~$0.01-0.02 per image. 5-image site = ~$0.05-0.10.

### Fallback

No Google API key → skip with `{ passed: true, skipped: true, reason: "..." }`.

---

## 3. New Files

- `src/tools/contrast.ts` — WCAG contrast math (parseHex, luminance, contrastRatio, samplePngBrightness)
- `src/tools/verify-images.ts` — new MCP tool
- `tests/tools/contrast.test.ts` — pure math tests
- `tests/tools/verify-images.test.ts` — tests with mock

## 4. Modified Files

- `src/tools/ada-check.ts` — add 3 contrast checks using contrast.ts utilities
- `src/tools/index.ts` — register verify_images
- `tests/tools/ada-check.test.ts` — add contrast check tests
- `tests/integration.test.ts` — add verify_images to pipeline (with mock)
