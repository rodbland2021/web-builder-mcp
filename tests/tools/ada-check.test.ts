import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { adaCheck } from "../../src/tools/ada-check.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const COMPLIANT_HTML = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <title>Test Site</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a href="#main-content" class="skip-to-content">Skip to content</a>
  <header>
    <nav aria-label="Main navigation">
      <ul><li><a href="/">Home</a></li></ul>
    </nav>
  </header>
  <main id="main-content">
    <h1>Welcome</h1>
    <h2>Services</h2>
    <h3>Details</h3>
    <img src="hero.jpg" alt="Hero image showing our team">
    <form>
      <label for="email">Email address</label>
      <input type="email" id="email" name="email" required>
      <label for="name">Your name</label>
      <input type="text" id="name" name="name">
    </form>
  </main>
  <footer>
    <p>Footer content</p>
  </footer>
</body>
</html>`;

const COMPLIANT_CSS = `:root { --color-primary: #2563eb; }
*:focus-visible { outline: 2px solid var(--color-primary); }
`;

describe("adaCheck", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-ada-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("passes on a fully compliant site", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = adaCheck(siteDir);

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags missing alt attribute as critical", () => {
    const html = COMPLIANT_HTML.replace(
      '<img src="hero.jpg" alt="Hero image showing our team">',
      '<img src="hero.jpg">'
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = adaCheck(siteDir);

    expect(result.passed).toBe(false);
    const altViolation = result.violations.find((v) =>
      v.description.toLowerCase().includes("alt")
    );
    expect(altViolation).toBeDefined();
    expect(altViolation?.severity).toBe("critical");
  });

  it("flags missing label for input as serious", () => {
    const html = COMPLIANT_HTML.replace(
      '<label for="email">Email address</label>\n      <input type="email" id="email" name="email" required>',
      '<input type="email" id="email" name="email" required>'
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = adaCheck(siteDir);

    expect(result.passed).toBe(false);
    const labelViolation = result.violations.find((v) =>
      v.description.toLowerCase().includes("label")
    );
    expect(labelViolation).toBeDefined();
    expect(labelViolation?.severity).toBe("serious");
  });

  it("flags missing lang attribute as critical", () => {
    const html = COMPLIANT_HTML.replace("<html lang=\"en-AU\">", "<html>");
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = adaCheck(siteDir);

    expect(result.passed).toBe(false);
    const langViolation = result.violations.find((v) =>
      v.description.toLowerCase().includes("lang")
    );
    expect(langViolation).toBeDefined();
    expect(langViolation?.severity).toBe("critical");
  });

  it("flags skipped heading levels as serious", () => {
    // Skip from h1 to h3 (missing h2)
    const html = COMPLIANT_HTML.replace(
      "<h1>Welcome</h1>\n    <h2>Services</h2>\n    <h3>Details</h3>",
      "<h1>Welcome</h1>\n    <h3>Details</h3>"
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "styles.css"), COMPLIANT_CSS);

    const result = adaCheck(siteDir);

    expect(result.passed).toBe(false);
    const headingViolation = result.violations.find((v) =>
      v.description.toLowerCase().includes("heading")
    );
    expect(headingViolation).toBeDefined();
    expect(headingViolation?.severity).toBe("serious");
  });
});
