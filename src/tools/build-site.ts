import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config, Palette, ImageProvider } from "../types.js";
import { createImageProvider } from "./image-generator.js";
import {
  generateStyles,
  generateSiteJs,
  generateHtmlPage,
  escapeHtml,
  safeJsonForScript,
} from "./templates.js";

const BusinessTypeEnum = z.enum([
  "service",
  "e-commerce",
  "hybrid",
  "portfolio",
  "research-portal",
]);

const PaletteSchema = z.object({
  bg: z.string(),
  bgAlt: z.string(),
  text: z.string(),
  textMuted: z.string(),
  primary: z.string(),
  primaryDark: z.string(),
  accent: z.string(),
  surface: z.string(),
  border: z.string(),
});

export const BuildSiteInput = {
  businessName: z.string().describe("Name of the business"),
  businessType: BusinessTypeEnum,
  location: z.string().describe("Business location (city, state/country)"),
  outputDir: z.string().describe("Absolute path to write files into"),
  hero: z.object({
    headline: z.string(),
    tagline: z.string(),
    cta: z.object({ text: z.string(), href: z.string() }),
    secondaryCta: z
      .object({ text: z.string(), href: z.string() })
      .optional(),
    imagePrompt: z.string().optional(),
  }),
  services: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        iconPrompt: z.string().optional(),
      })
    )
    .optional(),
  about: z
    .object({
      story: z.string(),
      mission: z.string().optional(),
      teamDescription: z.string().optional(),
    })
    .optional(),
  trustBadges: z.array(z.string()).optional(),
  contactInfo: z
    .object({
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      hours: z.string().optional(),
    })
    .optional(),
  palette: PaletteSchema,
  fontFamily: z.string().optional(),
  lang: z.string().optional(),
};

type BuildSiteInputType = z.objectOutputType<typeof BuildSiteInput, z.ZodTypeAny>;

export interface BuildSiteResult {
  files: string[];
  outputDir: string;
  imagesGenerated: number;
  imageProvider: string;
  estimatedImageCost: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function buildSite(
  input: BuildSiteInputType,
  opts: { imageProvider: ImageProvider }
): Promise<BuildSiteResult> {
  const {
    businessName,
    businessType,
    location,
    outputDir,
    hero,
    services,
    about,
    trustBadges,
    contactInfo,
    palette,
    fontFamily = "Inter, system-ui, sans-serif",
    lang = "en-US",
  } = input;

  const provider = opts.imageProvider;
  let imagesGenerated = 0;

  mkdirSync(join(outputDir, "images"), { recursive: true });

  const files: string[] = [];

  // --- Generate images ---

  // Hero image
  const heroPrompt =
    hero.imagePrompt ||
    `Professional hero image for ${businessName} ${businessType} in ${location}`;
  await provider.generate(heroPrompt, join(outputDir, "images/hero.jpg"));
  imagesGenerated++;

  // Service icons
  if (services && services.length > 0) {
    for (const service of services) {
      const serviceSlug = slugify(service.name);
      const iconPrompt =
        service.iconPrompt ||
        `Simple flat icon for ${service.name} service, minimal line art`;
      await provider.generate(
        iconPrompt,
        join(outputDir, `images/service-${serviceSlug}.jpg`)
      );
      imagesGenerated++;
    }
  }

  // About image
  if (about) {
    await provider.generate(
      `About page image for ${businessName}`,
      join(outputDir, "images/about.jpg")
    );
    imagesGenerated++;
  }

  // --- styles.css ---
  const css = generateStyles(palette as Palette, fontFamily);
  writeFileSync(join(outputDir, "styles.css"), css, "utf-8");
  files.push("styles.css");

  // --- site.js ---
  const js = generateSiteJs();
  writeFileSync(join(outputDir, "site.js"), js, "utf-8");
  files.push("site.js");

  // --- Shared nav links for all pages ---
  const isServiceLike =
    businessType === "service" || businessType === "hybrid";
  const navLinks = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "About" },
    ...(businessType === "e-commerce" || businessType === "hybrid"
      ? [{ href: "shop.html", label: "Shop" }]
      : []),
    ...(isServiceLike
      ? [{ href: "contact.html", label: "Contact" }]
      : []),
  ];

  const safeName = escapeHtml(businessName);
  const safeLocation = escapeHtml(location);

  // LD+JSON structured data
  const schemaType =
    businessType === "e-commerce" ? "Organization" : "LocalBusiness";
  const ldJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: businessName,
      description: hero.tagline,
      image: "images/hero.jpg",
      address: {
        "@type": "PostalAddress",
        addressLocality: location,
      },
      ...(contactInfo?.phone ? { telephone: contactInfo.phone } : {}),
      ...(contactInfo?.email ? { email: contactInfo.email } : {}),
      url: "",
    },
    null,
    2
  );

  // --- Trust badges ---
  const trustBadgesHtml =
    trustBadges && trustBadges.length > 0
      ? `\n        <div class="trust-badges">\n${trustBadges
          .map(
            (badge) =>
              `          <span class="trust-badge">${escapeHtml(badge)}</span>`
          )
          .join("\n")}\n        </div>`
      : "";

  // --- Services section ---
  let servicesHtml = "";
  if (services && services.length > 0) {
    const serviceCards = services
      .map((s) => {
        const serviceSlug = slugify(s.name);
        return `          <div class="feature-card">
            <img src="images/service-${serviceSlug}.jpg" alt="${escapeHtml(s.name)}">
            <h3>${escapeHtml(s.name)}</h3>
            <p>${escapeHtml(s.description)}</p>
          </div>`;
      })
      .join("\n");

    servicesHtml = `
    <section class="section section-alt text-center">
      <div class="container">
        <h2 class="section-title">Our Services</h2>
        <div class="feature-grid">
${serviceCards}
        </div>
      </div>
    </section>`;
  }

  // --- CTA section ---
  const ctaSection = `
    <section class="cta">
      <div class="container">
        <h2>Ready to get started?</h2>
        <p>Contact us today and let's discuss how we can help you.</p>
        <a href="${isServiceLike ? "contact.html" : "about.html"}" class="btn btn-outline">Contact us</a>
      </div>
    </section>`;

  // --- Footer content ---
  const footerColumns: string[] = [];

  // Page links column
  footerColumns.push(`      <div class="footer-col">
        <p class="footer-col-title">Pages</p>
        <ul>
${navLinks.map((l) => `          <li><a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a></li>`).join("\n")}
        </ul>
      </div>`);

  // Contact info column
  if (contactInfo) {
    const contactItems: string[] = [];
    if (contactInfo.phone)
      contactItems.push(
        `<p><a href="tel:${escapeHtml(contactInfo.phone.replace(/\s/g, ""))}">${escapeHtml(contactInfo.phone)}</a></p>`
      );
    if (contactInfo.email)
      contactItems.push(
        `<p><a href="mailto:${escapeHtml(contactInfo.email)}">${escapeHtml(contactInfo.email)}</a></p>`
      );
    if (contactInfo.address)
      contactItems.push(`<p>${escapeHtml(contactInfo.address)}</p>`);
    if (contactItems.length > 0) {
      footerColumns.push(`      <div class="footer-col">
        <p class="footer-col-title">Contact</p>
${contactItems.map((item) => `        ${item}`).join("\n")}
      </div>`);
    }
  }

  // Hours column
  if (contactInfo?.hours) {
    footerColumns.push(`      <div class="footer-col">
        <p class="footer-col-title">Hours</p>
        <p>${escapeHtml(contactInfo.hours)}</p>
      </div>`);
  }

  const footerContent =
    footerColumns.length > 0
      ? `      <div class="footer-grid">\n${footerColumns.join("\n")}\n      </div>`
      : undefined;

  // --- Hero section (uses class-based background via extraHead <style>) ---
  const heroExtraHead = `  <style>.hero-bg { background-image: url('images/hero.jpg'); }</style>\n`;

  const heroSection = `    <section class="hero hero-bg">
      <div class="hero-overlay"></div>
      <div class="hero-content container">
        <h1>${escapeHtml(hero.headline)}</h1>
        <p>${escapeHtml(hero.tagline)}</p>
        <div class="hero-cta">
          <a href="${escapeHtml(hero.cta.href)}" class="btn btn-primary">${escapeHtml(hero.cta.text)}</a>${
    hero.secondaryCta
      ? `\n          <a href="${escapeHtml(hero.secondaryCta.href)}" class="btn btn-hero-secondary">${escapeHtml(hero.secondaryCta.text)}</a>`
      : ""
  }
        </div>${trustBadgesHtml}
      </div>
    </section>`;

  // --- index.html ---
  const indexBody = `${heroSection}
${servicesHtml}
${ctaSection}

    <script type="application/ld+json">
${safeJsonForScript(ldJson)}
    </script>`;

  const indexHtml = generateHtmlPage({
    title: businessName,
    bodyContent: indexBody,
    lang,
    description: hero.tagline,
    fontFamily,
    businessName: safeName,
    navLinks,
    canonicalUrl: "index.html",
    phone: contactInfo?.phone,
    ctaButton: hero.cta,
    footerContent,
    extraHead: heroExtraHead,
  });
  writeFileSync(join(outputDir, "index.html"), indexHtml, "utf-8");
  files.push("index.html");

  // --- about.html ---
  const aboutStory = about?.story ?? `${safeName} is a trusted ${escapeHtml(businessType)} business based in ${safeLocation}.`;
  const aboutMission = about?.mission
    ? `\n          <h2>Our Mission</h2>\n          <p>${escapeHtml(about.mission)}</p>`
    : "";
  const aboutTeam = about?.teamDescription
    ? `\n          <h2>Our Team</h2>\n          <p>${escapeHtml(about.teamDescription)}</p>`
    : "";

  const aboutLdJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: `About ${businessName}`,
      description: `About ${businessName} — ${location}`,
      image: "images/about.jpg",
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
          <h2>Our Story</h2>
          <p>${escapeHtml(aboutStory)}</p>${aboutMission}${aboutTeam}
          <h2>Our Location</h2>
          <p>We proudly serve clients in ${safeLocation} and the surrounding area.</p>
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
    phone: contactInfo?.phone,
    footerContent,
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

    const contactDetailsHtml: string[] = [];
    if (contactInfo?.phone) {
      contactDetailsHtml.push(
        `<p><strong>Phone:</strong> <a href="tel:${escapeHtml(contactInfo.phone.replace(/\s/g, ""))}">${escapeHtml(contactInfo.phone)}</a></p>`
      );
    }
    if (contactInfo?.email) {
      contactDetailsHtml.push(
        `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(contactInfo.email)}">${escapeHtml(contactInfo.email)}</a></p>`
      );
    }
    if (contactInfo?.address) {
      contactDetailsHtml.push(
        `<p><strong>Address:</strong> ${escapeHtml(contactInfo.address)}</p>`
      );
    }
    if (contactInfo?.hours) {
      contactDetailsHtml.push(
        `<p><strong>Hours:</strong> ${escapeHtml(contactInfo.hours)}</p>`
      );
    }

    const contactInfoSection =
      contactDetailsHtml.length > 0
        ? `\n          <div class="flow">\n${contactDetailsHtml.map((d) => `            ${d}`).join("\n")}\n          </div>`
        : "";

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
          </form>${contactInfoSection}
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
      phone: contactInfo?.phone,
      footerContent,
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

  // Estimate cost based on provider name
  const costPerImage =
    provider.name === "gemini-2.5-flash"
      ? 0.04
      : provider.name === "unsplash"
        ? 0
        : 0;
  const totalCost = costPerImage * imagesGenerated;
  const estimatedImageCost =
    totalCost > 0 ? `$${totalCost.toFixed(2)}` : "$0.00 (free)";

  return {
    files,
    outputDir,
    imagesGenerated,
    imageProvider: provider.name,
    estimatedImageCost,
  };
}

const PALETTE_GUIDELINES = `PALETTE GUIDELINES — the agent calling this tool MUST follow these rules when choosing palette colours:

COLOUR THEORY: Use complementary (opposite on colour wheel — high contrast, energetic), analogous (adjacent — harmonious, calm), or triadic (evenly spaced — vibrant, balanced) schemes. Never pick random colours.

WCAG CONTRAST: Text on background must have >= 4.5:1 contrast ratio. Primary buttons with white text need dark-enough primary colour. Test textMuted against bg.

INDUSTRY CONVENTIONS:
- Medical/health: blues, greens, whites (trust, cleanliness)
- Legal/finance: navy, dark blue, gold (authority, premium)
- Food/hospitality: warm oranges, reds, creams (appetite, warmth)
- Tech/SaaS: blues, purples, clean whites (innovation, trust)
- Nature/outdoor: greens, earth tones, sky blues (natural, fresh)
- Luxury: black, gold, deep purple (premium, exclusive)

PALETTE FIELDS (all 9 required): bg (page background), bgAlt (alternating section bg), text (primary text), textMuted (secondary text), primary (brand/CTA colour), primaryDark (hover state), accent (highlights/badges), surface (card backgrounds), border (dividers/borders).`;

export function registerBuildSite(server: McpServer, config: Config): void {
  const provider = createImageProvider(config);

  server.registerTool(
    "build_site",
    {
      description: `Generate a complete, production-quality website from structured content with AI-generated images, full colour palette, trust badges, and professional layout.\n\n${PALETTE_GUIDELINES}`,
      inputSchema: BuildSiteInput,
    },
    async (args) => {
      const result = await buildSite(args as BuildSiteInputType, {
        imageProvider: provider,
      });
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
