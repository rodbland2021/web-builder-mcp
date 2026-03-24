import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { seoAudit } from "../../src/tools/seo-audit.js";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const COMPLIANT_HTML = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Business — Melbourne</title>
  <meta name="description" content="Test Business provides quality services in Melbourne.">
  <link rel="canonical" href="https://testbusiness.com.au/">
  <meta property="og:title" content="Test Business — Melbourne">
  <meta property="og:description" content="Quality services in Melbourne.">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Test Business"}</script>
</head>
<body>
  <h1>Welcome to Test Business</h1>
  <p>We provide quality services.</p>
</body>
</html>`;

describe("seoAudit", () => {
  let siteDir: string;

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-seo-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("passes on a fully compliant site", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    writeFileSync(join(siteDir, "sitemap.xml"), "<urlset></urlset>");
    writeFileSync(join(siteDir, "robots.txt"), "User-agent: *\nDisallow:");

    const result = seoAudit(siteDir);

    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it("fails when title tag is missing", () => {
    const html = COMPLIANT_HTML.replace(
      "<title>Test Business — Melbourne</title>",
      ""
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "sitemap.xml"), "<urlset></urlset>");
    writeFileSync(join(siteDir, "robots.txt"), "User-agent: *\nDisallow:");

    const result = seoAudit(siteDir);

    expect(result.passed).toBe(false);
    const titleCheck = result.checks.find((c) => c.name === "title-tag");
    expect(titleCheck?.passed).toBe(false);
  });

  it("fails when meta description is missing", () => {
    const html = COMPLIANT_HTML.replace(
      '<meta name="description" content="Test Business provides quality services in Melbourne.">',
      ""
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "sitemap.xml"), "<urlset></urlset>");
    writeFileSync(join(siteDir, "robots.txt"), "User-agent: *\nDisallow:");

    const result = seoAudit(siteDir);

    expect(result.passed).toBe(false);
    const descCheck = result.checks.find((c) => c.name === "meta-description");
    expect(descCheck?.passed).toBe(false);
  });

  it("fails when h1 is missing", () => {
    const html = COMPLIANT_HTML.replace(
      "<h1>Welcome to Test Business</h1>",
      ""
    );
    writeFileSync(join(siteDir, "index.html"), html);
    writeFileSync(join(siteDir, "sitemap.xml"), "<urlset></urlset>");
    writeFileSync(join(siteDir, "robots.txt"), "User-agent: *\nDisallow:");

    const result = seoAudit(siteDir);

    expect(result.passed).toBe(false);
    const h1Check = result.checks.find((c) => c.name === "h1-present");
    expect(h1Check?.passed).toBe(false);
  });

  it("checks for sitemap.xml and robots.txt existence", () => {
    writeFileSync(join(siteDir, "index.html"), COMPLIANT_HTML);
    // No sitemap.xml or robots.txt

    const result = seoAudit(siteDir);

    expect(result.passed).toBe(false);
    const sitemapCheck = result.checks.find((c) => c.name === "sitemap-xml");
    const robotsCheck = result.checks.find((c) => c.name === "robots-txt");
    expect(sitemapCheck?.passed).toBe(false);
    expect(robotsCheck?.passed).toBe(false);
  });
});
