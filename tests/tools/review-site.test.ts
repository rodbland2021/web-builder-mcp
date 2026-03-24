import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { reviewSite } from "../../src/tools/review-site.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const COMPLIANT_HTML = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a href="#main-content" class="skip-to-content">Skip to content</a>
  <header><nav><button class="nav-toggle" aria-label="Menu">☰</button></nav></header>
  <main id="main-content">
    <img src="hero.jpg" alt="Hero image">
    <h1>Welcome</h1>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Test"}</script>
  </main>
  <footer>
    <p>&copy; <script>document.write(new Date().getFullYear())</script> Test</p>
  </footer>
</body>
</html>`;

const COMPLIANT_CSS = `:root {
  --color-primary: #2563eb;
  --color-text: #1e293b;
}

*:focus-visible {
  outline: 2px solid var(--color-primary);
}

.skip-to-content {
  position: absolute;
  top: -40px;
}
`;

describe("reviewSite", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-review-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("passes all checks on a compliant site", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(result.total);
  });

  it("fails when skip-to-content link is missing", () => {
    const html = COMPLIANT_HTML.replace(
      '<a href="#main-content" class="skip-to-content">Skip to content</a>',
      ""
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(result.passed).toBe(false);
    const skipCheck = result.checks.find((c) => c.name === "skip-to-content");
    expect(skipCheck?.passed).toBe(false);
  });

  it("fails when inline styles are present", () => {
    const html = COMPLIANT_HTML.replace(
      '<h1>Welcome</h1>',
      '<h1 style="color: red;">Welcome</h1>'
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(result.passed).toBe(false);
    const inlineCheck = result.checks.find((c) => c.name === "no-inline-styles");
    expect(inlineCheck?.passed).toBe(false);
  });

  it("fails when an image is missing alt attribute", () => {
    const html = COMPLIANT_HTML.replace(
      '<img src="hero.jpg" alt="Hero image">',
      '<img src="hero.jpg">'
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(result.passed).toBe(false);
    const altCheck = result.checks.find((c) => c.name === "img-alt-attributes");
    expect(altCheck?.passed).toBe(false);
  });

  it("returns a numeric score out of total", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(typeof result.score).toBe("number");
    expect(typeof result.total).toBe("number");
    expect(result.total).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(result.total);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("returns check details with name and passed fields", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = reviewSite(siteDir);

    expect(result.checks).toBeInstanceOf(Array);
    expect(result.checks.length).toBeGreaterThan(0);
    for (const check of result.checks) {
      expect(typeof check.name).toBe("string");
      expect(typeof check.passed).toBe("boolean");
    }
  });
});
