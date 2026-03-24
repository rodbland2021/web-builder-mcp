import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateStyles, generateSiteJs, generateHtmlPage, escapeHtml, safeJsonForScript } from "./templates.js";

export const BuildSiteInput = {
  businessName: z.string().describe("Name of the business"),
  businessType: z.enum(["service", "e-commerce", "hybrid", "portfolio", "research-portal"]),
  location: z.string().describe("Business location (city, state/country)"),
  outputDir: z.string().describe("Absolute path to write files into"),
  tagline: z.string().optional().describe("Short business tagline"),
  primaryColor: z.string().optional().default("#2563eb").describe("Brand primary colour (hex)"),
  fontFamily: z.string().optional().default("Inter, system-ui, sans-serif"),
  lang: z.string().optional().default("en-US").describe("HTML lang attribute (e.g. en-AU)"),
};

type BuildSiteInputType = {
  businessName: string;
  businessType: "service" | "e-commerce" | "hybrid" | "portfolio" | "research-portal";
  location: string;
  outputDir: string;
  tagline?: string;
  primaryColor?: string;
  fontFamily?: string;
  lang?: string;
};

export interface BuildSiteResult {
  files: string[];
  outputDir: string;
}

// escapeHtml imported from templates.ts

export function buildSite(input: BuildSiteInputType): BuildSiteResult {
  const {
    businessName,
    businessType,
    location,
    outputDir,
    tagline,
    primaryColor = "#2563eb",
    fontFamily = "Inter, system-ui, sans-serif",
    lang = "en-US",
  } = input;

  mkdirSync(outputDir, { recursive: true });

  const files: string[] = [];

  // --- styles.css ---
  const css = generateStyles({ primaryColor, fontFamily });
  writeFileSync(join(outputDir, "styles.css"), css, "utf-8");
  files.push("styles.css");

  // --- site.js ---
  const js = generateSiteJs();
  writeFileSync(join(outputDir, "site.js"), js, "utf-8");
  files.push("site.js");

  // --- Shared nav links for all pages ---
  const isServiceLike = businessType === "service" || businessType === "hybrid";
  const navLinks = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "About" },
    ...(businessType === "e-commerce" || businessType === "hybrid"
      ? [{ href: "shop.html", label: "Shop" }]
      : []),
    ...(isServiceLike ? [{ href: "contact.html", label: "Contact" }] : []),
  ];

  // LD+JSON structured data
  const schemaType = businessType === "e-commerce" ? "Organization" : "LocalBusiness";
  const ldJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: businessName,
      description: tagline ?? `${businessName} — serving ${location}`,
      address: {
        "@type": "PostalAddress",
        addressLocality: location,
      },
      url: "",
    },
    null,
    2
  );

  // Escape user-supplied strings for safe HTML insertion
  const safeName = escapeHtml(businessName);
  const safeLocation = escapeHtml(location);
  const safeTagline = escapeHtml(tagline ?? `Serving ${location} with excellence`);

  const heroTagline = tagline ?? `Serving ${location} with excellence`;
  const featureItems = buildFeatureItems(businessType, safeName);

  // --- index.html ---
  const indexBody = `    <section class="hero">
      <div class="container">
        <h1>${safeName}</h1>
        <p>${safeTagline}</p>
        <div class="hero-cta">
          <a href="${isServiceLike ? "contact.html" : "about.html"}" class="btn btn-outline">Get in touch</a>
          <a href="about.html" class="btn btn-hero-secondary">Learn more</a>
        </div>
      </div>
    </section>

    <section class="section text-center">
      <div class="container">
        <h2 class="section-title">Why choose ${safeName}?</h2>
        <p class="section-lead">We're dedicated to providing exceptional quality and service to every client.</p>
        <div class="feature-grid">
${featureItems}
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container">
        <h2>Ready to get started?</h2>
        <p>Contact us today and let's discuss how we can help you.</p>
        <a href="${isServiceLike ? "contact.html" : "about.html"}" class="btn btn-outline">Contact us</a>
      </div>
    </section>

    <script type="application/ld+json">
${safeJsonForScript(ldJson)}
    </script>`;

  const indexHtml = generateHtmlPage({
    title: businessName,
    bodyContent: indexBody,
    lang,
    description: heroTagline,
    primaryColor,
    fontFamily,
    businessName: safeName,
    navLinks,
    canonicalUrl: "index.html",
  });
  writeFileSync(join(outputDir, "index.html"), indexHtml, "utf-8");
  files.push("index.html");

  // --- about.html ---
  const aboutLdJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: `About ${businessName}`,
      description: `About ${businessName} — ${location}`,
      mainEntity: {
        "@type": schemaType,
        name: businessName,
        address: { "@type": "PostalAddress", addressLocality: location },
      },
    },
    null,
    2
  );

  const aboutBody = `    <div class="page-header">
      <div class="container">
        <h1>About ${safeName}</h1>
        <p>Our story, values, and commitment to you.</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div class="flow container-narrow">
          <h2>Who we are</h2>
          <p>${safeName} is a trusted ${escapeHtml(businessType)} business based in ${safeLocation}. We are committed to delivering outstanding results for every client.</p>
          <h2>Our mission</h2>
          <p>We believe in quality, transparency, and building lasting relationships with our customers. Everything we do is guided by these values.</p>
          <h2>Our location</h2>
          <p>We proudly serve clients in ${safeLocation} and the surrounding area. Get in touch to find out how we can help you.</p>
        </div>
      </div>
    </section>

    <script type="application/ld+json">
${safeJsonForScript(aboutLdJson)}
    </script>`;

  const aboutHtml = generateHtmlPage({
    title: `About — ${businessName}`,
    bodyContent: aboutBody,
    lang,
    description: `About ${businessName} — ${location}`,
    businessName: safeName,
    navLinks,
    canonicalUrl: "about.html",
  });
  writeFileSync(join(outputDir, "about.html"), aboutHtml, "utf-8");
  files.push("about.html");

  // --- contact.html (for service/hybrid types) ---
  if (isServiceLike) {
    const contactLdJson = JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: `Contact ${businessName}`,
        description: `Contact ${businessName} in ${location}`,
        mainEntity: {
          "@type": schemaType,
          name: businessName,
          address: { "@type": "PostalAddress", addressLocality: location },
        },
      },
      null,
      2
    );

    const contactBody = `    <div class="page-header">
      <div class="container">
        <h1>Contact ${safeName}</h1>
        <p>We'd love to hear from you. Fill in the form and we'll be in touch shortly.</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div class="container-form">
          <p class="required-note"><span class="required-star">*</span> Required fields</p>
          <form id="contact-form" novalidate>
            <div class="form-group">
              <label for="contact-name">Full name <span class="required-star">*</span></label>
              <input type="text" id="contact-name" name="name" required autocomplete="name" placeholder="Your name">
            </div>
            <div class="form-group">
              <label for="contact-email">Email address <span class="required-star">*</span></label>
              <input type="email" id="contact-email" name="email" required autocomplete="email" placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="contact-phone">Phone number</label>
              <input type="tel" id="contact-phone" name="phone" autocomplete="tel" placeholder="Optional">
            </div>
            <div class="form-group">
              <label for="contact-message">Message <span class="required-star">*</span></label>
              <textarea id="contact-message" name="message" required rows="5" placeholder="How can we help?"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Send message</button>
          </form>
        </div>
      </div>
    </section>

    <script type="application/ld+json">
${safeJsonForScript(contactLdJson)}
    </script>`;

    const contactHtml = generateHtmlPage({
      title: `Contact — ${businessName}`,
      bodyContent: contactBody,
      lang,
      description: `Contact ${businessName} in ${location}`,
      businessName: safeName,
      navLinks,
      canonicalUrl: "contact.html",
    });
    writeFileSync(join(outputDir, "contact.html"), contactHtml, "utf-8");
    files.push("contact.html");
  }

  // --- robots.txt ---
  const robots = `User-agent: *
Allow: /

Sitemap: /sitemap.xml
`;
  writeFileSync(join(outputDir, "robots.txt"), robots, "utf-8");
  files.push("robots.txt");

  // --- sitemap.xml ---
  const sitemapPages = files
    .filter((f) => f.endsWith(".html"))
    .map((f) => `  <url><loc>${f}</loc></url>`)
    .join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages}
</urlset>
`;
  writeFileSync(join(outputDir, "sitemap.xml"), sitemap, "utf-8");
  files.push("sitemap.xml");

  return { files, outputDir };
}

function buildFeatureItems(businessType: string, businessName: string): string {
  const features: Array<{ icon: string; title: string; desc: string }> =
    businessType === "e-commerce"
      ? [
          { icon: "🛍️", title: "Quality products", desc: "Carefully sourced and curated for you." },
          { icon: "🚚", title: "Fast delivery", desc: "Quick and reliable shipping to your door." },
          { icon: "💳", title: "Secure checkout", desc: "Shop with confidence — always secure." },
        ]
      : businessType === "portfolio"
      ? [
          { icon: "🎨", title: "Creative work", desc: "A portfolio of diverse, quality projects." },
          { icon: "✨", title: "Attention to detail", desc: "Every element crafted with care." },
          { icon: "🤝", title: "Collaborative", desc: "Partnership-driven approach every time." },
        ]
      : [
          { icon: "⭐", title: "Expert service", desc: `${businessName} brings years of experience.` },
          { icon: "✅", title: "Reliable results", desc: "Consistent quality you can count on." },
          { icon: "❤️", title: "Customer first", desc: "Your satisfaction drives everything we do." },
        ];

  return features
    .map(
      (f) => `          <div class="feature-card">
            <div class="feature-icon">${f.icon}</div>
            <h3>${f.title}</h3>
            <p>${f.desc}</p>
          </div>`
    )
    .join("\n");
}

export function registerBuildSite(server: McpServer): void {
  server.registerTool(
    "build_site",
    {
      description:
        "Generate a complete, production-quality website file tree (HTML/CSS/JS, robots.txt, sitemap.xml) with accessibility and SEO baked in",
      inputSchema: BuildSiteInput,
    },
    async (args) => {
      const result = buildSite(args as BuildSiteInputType);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
