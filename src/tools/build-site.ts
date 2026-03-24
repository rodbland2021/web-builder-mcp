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
  ctaSection: z
    .object({
      heading: z.string(),
      text: z.string(),
      buttonText: z.string(),
      buttonHref: z.string(),
    })
    .optional()
    .describe("Custom CTA section. If omitted, uses hero CTA text as fallback."),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .optional()
    .describe("FAQ items — adds FAQ accordion and FAQPage LD+JSON to index.html"),
  siteUrl: z
    .string()
    .optional()
    .describe("Full site URL (e.g. https://example.com) for absolute URLs in sitemap and canonical tags"),
  palette: PaletteSchema,
  fontFamily: z.string().optional(),
  lang: z
    .string()
    .optional()
    .describe("BCP 47 language tag (e.g. en-AU, en-US). Set to match the business location."),
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

/** Industry-specific about page fallback when no story is provided (M5) */
function aboutFallback(businessName: string, businessType: string, location: string): string {
  const safeName = escapeHtml(businessName);
  const safeLocation = escapeHtml(location);
  switch (businessType) {
    case "service":
      return `${safeName} has been proudly serving ${safeLocation} with dedication and expertise.`;
    case "e-commerce":
      return `${safeName} offers carefully curated products, delivered with care from ${safeLocation}.`;
    case "hybrid":
      return `${safeName} combines quality products and services, proudly based in ${safeLocation}.`;
    case "portfolio":
      return `${safeName} creates distinctive work from their studio in ${safeLocation}.`;
    default:
      return `${safeName} has been proudly serving ${safeLocation} with dedication and expertise.`;
  }
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
    ctaSection: customCta,
    faqs,
    siteUrl,
    palette,
    fontFamily = "Inter, system-ui, sans-serif",
    lang = "en-US",
  } = input;

  const provider = opts.imageProvider;
  let imagesGenerated = 0;

  mkdirSync(join(outputDir, "images"), { recursive: true });

  const files: string[] = [];

  // --- Generate images (M1: use .png extension since Imagen returns PNG data) ---

  // Hero image
  const heroPrompt =
    hero.imagePrompt ||
    `Professional hero image for ${businessName} ${businessType} in ${location}`;
  await provider.generate(heroPrompt, join(outputDir, "images/hero.png"));
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
        join(outputDir, `images/service-${serviceSlug}.png`)
      );
      imagesGenerated++;
    }
  }

  // About image
  if (about) {
    await provider.generate(
      `About page image for ${businessName}`,
      join(outputDir, "images/about.png")
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

  // --- S8: Generate SVG favicon ---
  const firstLetter = businessName.charAt(0).toUpperCase();
  const primaryColor = (palette as Palette).primary;
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="16" fill="${primaryColor}"/>
  <text x="50" y="72" text-anchor="middle" fill="white" font-family="system-ui, sans-serif" font-size="60" font-weight="700">${firstLetter}</text>
</svg>`;
  writeFileSync(join(outputDir, "favicon.svg"), faviconSvg, "utf-8");
  files.push("favicon.svg");

  // --- Shared nav links for all pages (M3: no premature Shop/Book links) ---
  const isServiceLike =
    businessType === "service" || businessType === "hybrid";
  const navLinks = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "About" },
    ...(isServiceLike
      ? [{ href: "contact.html", label: "Contact" }]
      : []),
  ];

  const safeName = escapeHtml(businessName);
  const safeLocation = escapeHtml(location);

  // Helper for absolute URLs (S5)
  const absUrl = (path: string): string =>
    siteUrl ? `${siteUrl.replace(/\/$/, "")}/${path}` : path;

  // LD+JSON structured data (P1: use siteUrl if available, omit url if not)
  const schemaType =
    businessType === "e-commerce" ? "Organization" : "LocalBusiness";
  const ldJsonObj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: businessName,
    description: hero.tagline,
    image: absUrl("images/hero.png"),
    address: {
      "@type": "PostalAddress",
      addressLocality: location,
    },
    ...(contactInfo?.phone ? { telephone: contactInfo.phone } : {}),
    ...(contactInfo?.email ? { email: contactInfo.email } : {}),
  };
  if (siteUrl) {
    ldJsonObj.url = siteUrl;
  }
  const ldJson = JSON.stringify(ldJsonObj, null, 2);

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

  // --- Services section (S1: lazy loading on below-fold images) ---
  let servicesHtml = "";
  if (services && services.length > 0) {
    const serviceCards = services
      .map((s) => {
        const serviceSlug = slugify(s.name);
        return `          <div class="feature-card">
            <img src="images/service-${serviceSlug}.png" alt="${escapeHtml(s.name)}" loading="lazy">
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

  // --- CTA section (M4: customizable, falls back to hero CTA) ---
  const ctaHeading = customCta?.heading ?? hero.cta.text;
  const ctaText = customCta?.text ?? hero.tagline;
  const ctaButtonText = customCta?.buttonText ?? hero.cta.text;
  const ctaButtonHref = customCta?.buttonHref ?? hero.cta.href;

  const ctaSectionHtml = `
    <section class="cta">
      <div class="container">
        <h2>${escapeHtml(ctaHeading)}</h2>
        <p>${escapeHtml(ctaText)}</p>
        <a href="${escapeHtml(ctaButtonHref)}" class="btn btn-outline">${escapeHtml(ctaButtonText)}</a>
      </div>
    </section>`;

  // --- Footer content (S9: use h3 instead of p for column titles) ---
  const footerColumns: string[] = [];

  // Page links column
  footerColumns.push(`      <div class="footer-col">
        <h2 class="footer-col-title">Pages</h2>
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
        <h2 class="footer-col-title">Contact</h2>
${contactItems.map((item) => `        ${item}`).join("\n")}
      </div>`);
    }
  }

  // Hours column
  if (contactInfo?.hours) {
    footerColumns.push(`      <div class="footer-col">
        <h2 class="footer-col-title">Hours</h2>
        <p>${escapeHtml(contactInfo.hours)}</p>
      </div>`);
  }

  const footerContent =
    footerColumns.length > 0
      ? `      <div class="footer-grid">\n${footerColumns.join("\n")}\n      </div>`
      : undefined;

  // S8: favicon link tag
  const faviconHead = `  <link rel="icon" href="favicon.svg" type="image/svg+xml">\n`;

  // --- Hero section (uses class-based background via extraHead <style>) ---
  const heroExtraHead = `  <style>.hero-bg { background-image: url('images/hero.png'); }</style>\n${faviconHead}`;

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

  // --- FAQ section (feature 4) ---
  let faqSectionHtml = "";
  let faqLdJson: string | undefined;
  if (faqs && faqs.length > 0) {
    const faqItems = faqs
      .map(
        (faq) =>
          `      <details class="faq-item">
        <summary class="faq-question">${escapeHtml(faq.question)}</summary>
        <div class="faq-answer"><p>${escapeHtml(faq.answer)}</p></div>
      </details>`
      )
      .join("\n");

    faqSectionHtml = `
    <section class="section faq-section">
      <div class="container container-narrow">
        <h2 class="section-title text-center">Frequently Asked Questions</h2>
        <div class="faq-list">
${faqItems}
        </div>
      </div>
    </section>`;

    faqLdJson = safeJsonForScript(
      JSON.stringify(
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        },
        null,
        2
      )
    );
  }

  // --- index.html (P4: LD+JSON via template, not in bodyContent) ---
  const indexBody = `${heroSection}
${servicesHtml}
${faqSectionHtml}
${ctaSectionHtml}`;

  const indexHtml = generateHtmlPage({
    title: businessName,
    bodyContent: indexBody,
    lang,
    description: hero.tagline,
    fontFamily,
    businessName: safeName,
    navLinks,
    currentPage: "index.html",
    canonicalUrl: absUrl("index.html"),
    phone: contactInfo?.phone,
    ctaButton: hero.cta,
    footerContent,
    extraHead: heroExtraHead,
    ogImage: absUrl("images/hero.png"),
    preloadImage: "images/hero.png",
    breadcrumbs: [{ name: "Home", url: "index.html" }],
    ldJson: safeJsonForScript(ldJson),
    faqLdJson,
  });
  writeFileSync(join(outputDir, "index.html"), indexHtml, "utf-8");
  files.push("index.html");

  // --- about.html ---
  // M5: industry-specific fallback when no story provided
  const aboutStory = about?.story ?? aboutFallback(businessName, businessType, location);
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
      image: absUrl("images/about.png"),
      mainEntity: {
        "@type": schemaType,
        name: businessName,
        address: { "@type": "PostalAddress", addressLocality: location },
      },
    },
    null,
    2
  );

  // Internal link to contact page (only if contact.html is generated)
  const aboutContactLink = isServiceLike
    ? `\n          <p><a href="contact.html">Get in touch →</a></p>`
    : "";

  const aboutBody = `    <div class="page-header">
      <div class="container">
        <h1>About ${safeName}</h1>
        <p>Our story, values, and commitment to you.</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div class="flow container-narrow">
          <img src="images/about.png" alt="About ${safeName}" class="about-photo" loading="lazy">
          <h2>Our Story</h2>
          <p>${escapeHtml(aboutStory)}</p>${aboutMission}${aboutTeam}
          <h2>Our Location</h2>
          <p>We proudly serve clients in ${safeLocation} and the surrounding area.</p>${aboutContactLink}
        </div>
      </div>
    </section>`;

  const aboutHtml = generateHtmlPage({
    title: `About — ${businessName}`,
    bodyContent: aboutBody,
    lang,
    description: `About ${businessName} — ${location}`,
    businessName: safeName,
    navLinks,
    currentPage: "about.html",
    canonicalUrl: absUrl("about.html"),
    phone: contactInfo?.phone,
    footerContent,
    extraHead: faviconHead,
    breadcrumbs: [
      { name: "Home", url: "index.html" },
      { name: "About", url: "about.html" },
    ],
    ldJson: safeJsonForScript(aboutLdJson),
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

    // M2: Contact form with submit handler (same pattern as add-contact.ts)
    const contactFormScript = `
  <script>
  (function () {
    document.getElementById('contact-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var errorEl = document.getElementById('contact-error');
      var successEl = document.getElementById('contact-success');
      var btn = this.querySelector('button[type="submit"]');

      var name = document.getElementById('contact-name').value.trim();
      var email = document.getElementById('contact-email').value.trim();
      var phone = document.getElementById('contact-phone').value.trim();
      var message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !message) {
        errorEl.textContent = 'Please fill in all required fields.';
        errorEl.style.display = 'block';
        return;
      }

      errorEl.style.display = 'none';
      btn.disabled = true;

      try {
        var res = await fetch('/workers/contact-api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, phone: phone, message: message }),
        });
        var data = await res.json();
        if (data.ok) {
          successEl.style.display = 'block';
          this.reset();
        } else {
          errorEl.textContent = data.error || 'Something went wrong. Please try again.';
          errorEl.style.display = 'block';
          btn.disabled = false;
        }
      } catch (err) {
        errorEl.textContent = "Sorry, we couldn't send your message. Please call us or try again later.";
        errorEl.style.display = 'block';
        btn.disabled = false;
      }
    });
  })();
  </script>`;

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
          <div id="contact-error" class="form-error" role="alert"></div>
          <div id="contact-success" class="form-success" role="status">
            Thank you! Your message has been sent. We'll be in touch soon.
          </div>
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
          <p class="mt-xl"><a href="about.html">Learn more about us →</a></p>
        </div>
      </div>
    </section>
${contactFormScript}`;

    const contactHtml = generateHtmlPage({
      title: `Contact — ${businessName}`,
      bodyContent: contactBody,
      lang,
      description: `Contact ${businessName} in ${location}`,
      businessName: safeName,
      navLinks,
      currentPage: "contact.html",
      canonicalUrl: absUrl("contact.html"),
      phone: contactInfo?.phone,
      footerContent,
      extraHead: faviconHead,
      breadcrumbs: [
        { name: "Home", url: "index.html" },
        { name: "Contact", url: "contact.html" },
      ],
      ldJson: safeJsonForScript(contactLdJson),
    });
    writeFileSync(join(outputDir, "contact.html"), contactHtml, "utf-8");
    files.push("contact.html");
  }

  // --- robots.txt ---
  const sitemapUrl = siteUrl ? `${siteUrl.replace(/\/$/, "")}/sitemap.xml` : "/sitemap.xml";
  const robots = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
  writeFileSync(join(outputDir, "robots.txt"), robots, "utf-8");
  files.push("robots.txt");

  // --- sitemap.xml (S5: use absolute URLs when siteUrl provided, with lastmod/priority) ---
  const todayIso = new Date().toISOString().split("T")[0];
  const sitemapPages = files
    .filter((f) => f.endsWith(".html"))
    .map((f) => {
      let priority: string;
      let changefreq: string;
      if (f === "index.html" || f === "shop.html" || f === "booking.html") {
        priority = f === "index.html" ? "1.0" : "0.9";
        changefreq = "weekly";
      } else {
        priority = "0.8";
        changefreq = "monthly";
      }
      return `  <url>
    <loc>${absUrl(f)}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
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
