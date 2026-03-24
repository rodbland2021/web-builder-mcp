import { z } from "zod";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { generateHtmlPage } from "./templates.js";

export const AddContactInput = {
  siteDir: z.string().describe("Absolute path to existing site directory"),
  businessName: z.string().optional().describe("Business name for page heading"),
  email: z.string().optional().describe("Reply-to email address (configures Worker)"),
};

type AddContactInputType = {
  siteDir: string;
  businessName?: string;
  email?: string;
};

export interface AddContactResult {
  files: string[];
  siteDir: string;
}

export function addContact(input: AddContactInputType): AddContactResult {
  const { siteDir, businessName = "Contact Us", email = "" } = input;

  const files: string[] = [];
  mkdirSync(join(siteDir, "workers", "contact-api"), { recursive: true });

  // Detect existing nav links and business name from index.html
  let contactNavLinks: Array<{ href: string; label: string }> | undefined;
  let contactBusinessName: string | undefined;
  let contactLang: string | undefined;
  const contactIndexPath = join(siteDir, "index.html");
  if (existsSync(contactIndexPath)) {
    try {
      const indexContent = readFileSync(contactIndexPath, "utf-8");
      const logoMatch = indexContent.match(/class="nav-logo">([^<]+)</);
      if (logoMatch) contactBusinessName = logoMatch[1];
      const langMatch = indexContent.match(/<html[^>]+lang="([^"]+)"/);
      if (langMatch) contactLang = langMatch[1];
      const linkMatches = [...indexContent.matchAll(/class="nav-links"[\s\S]*?<\/ul>/g)];
      if (linkMatches.length > 0) {
        const navHtml = linkMatches[0][0];
        const hrefMatches = [...navHtml.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)];
        if (hrefMatches.length > 0) {
          contactNavLinks = hrefMatches.map((m) => ({ href: m[1], label: m[2] }));
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  const effectiveName = contactBusinessName ?? businessName;

  const contactLdJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: `Contact ${effectiveName}`,
      description: `Contact ${effectiveName}`,
    },
    null,
    2
  );

  // --- contact.html ---
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
        errorEl.textContent = 'Network error. Please try again later.';
        errorEl.style.display = 'block';
        btn.disabled = false;
      }
    });
  })();
  </script>`;

  const contactBodyContent = `    <div class="page-header">
      <div class="container">
        <h1>Contact ${effectiveName}</h1>
        <p>We'd love to hear from you. Send us a message and we'll get back to you shortly.</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div class="container-form">
          <p class="required-note"><span class="required-star">*</span> Required fields</p>
          <form id="contact-form" novalidate>
            <div class="form-group">
              <label for="contact-name">Full name <span class="required-star" aria-label="required">*</span></label>
              <input type="text" id="contact-name" name="name" required autocomplete="name" placeholder="Your full name" aria-required="true">
            </div>
            <div class="form-group">
              <label for="contact-email">Email address <span class="required-star" aria-label="required">*</span></label>
              <input type="email" id="contact-email" name="email" required autocomplete="email" placeholder="you@example.com" aria-required="true">
            </div>
            <div class="form-group">
              <label for="contact-phone">Phone number</label>
              <input type="tel" id="contact-phone" name="phone" autocomplete="tel" placeholder="Optional">
            </div>
            <div class="form-group">
              <label for="contact-message">Message <span class="required-star" aria-label="required">*</span></label>
              <textarea id="contact-message" name="message" required rows="5" placeholder="How can we help you?" aria-required="true"></textarea>
            </div>
            <div id="contact-error" class="form-error" role="alert"></div>
            <div id="contact-success" class="form-success" role="status">
              Thank you! Your message has been sent. We'll be in touch soon.
            </div>
            <button type="submit" class="btn btn-primary">Send message</button>
          </form>
        </div>
      </div>
    </section>

    <script type="application/ld+json">
${contactLdJson}
    </script>
${contactFormScript}`;

  const contactHtml = generateHtmlPage({
    title: `Contact — ${effectiveName}`,
    bodyContent: contactBodyContent,
    lang: contactLang,
    description: `Contact ${effectiveName}`,
    businessName: effectiveName,
    navLinks: contactNavLinks,
    canonicalUrl: "contact.html",
  });
  writeFileSync(join(siteDir, "contact.html"), contactHtml, "utf-8");
  files.push("contact.html");

  // --- workers/contact-api/index.js ---
  const replyTo = email || "your-email@example.com";
  const workerJs = `/* workers/contact-api/index.js — generated by web-builder-mcp */
/* Deploy with: wrangler deploy */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const NOTIFY_EMAIL = '${replyTo}';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function corsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return corsResponse();

    if (url.pathname === '/health') {
      return json({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/notify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { name, email, phone, message } = body;

        if (!name || !email || !message) {
          return json({ error: 'Missing required fields: name, email, message' }, 400);
        }

        // TODO: Send email via env.RESEND_API_KEY or env.SENDGRID_API_KEY
        // Example using Resend:
        // const res = await fetch('https://api.resend.com/emails', {
        //   method: 'POST',
        //   headers: {
        //     Authorization: \`Bearer \${env.RESEND_API_KEY}\`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     from: 'contact@yourdomain.com',
        //     to: env.NOTIFY_EMAIL || '${replyTo}',
        //     reply_to: email,
        //     subject: \`Contact form: \${name}\`,
        //     html: \`<p><strong>Name:</strong> \${name}</p><p><strong>Email:</strong> \${email}</p>\${phone ? \`<p><strong>Phone:</strong> \${phone}</p>\` : ''}<p><strong>Message:</strong></p><p>\${message}</p>\`,
        //   }),
        // });

        return json({ ok: true, message: 'Message received. Configure RESEND_API_KEY to enable email notifications.' });
      } catch (err) {
        return json({ error: 'Invalid request body' }, 400);
      }
    }

    return new Response('Not found', { status: 404 });
  },
};
`;
  writeFileSync(join(siteDir, "workers", "contact-api", "index.js"), workerJs, "utf-8");
  files.push("workers/contact-api/index.js");

  // --- workers/contact-api/wrangler.toml ---
  const wranglerToml = `name = "contact-api"
main = "index.js"
compatibility_date = "2024-01-01"

# Add your secrets:
# wrangler secret put RESEND_API_KEY
# wrangler secret put NOTIFY_EMAIL
`;
  writeFileSync(join(siteDir, "workers", "contact-api", "wrangler.toml"), wranglerToml, "utf-8");
  files.push("workers/contact-api/wrangler.toml");

  return { files, siteDir };
}

export function registerAddContact(server: McpServer): void {
  server.registerTool(
    "add_contact",
    {
      description:
        "Add a contact form page to an existing site with client-side validation, accessible form markup, and a Cloudflare Worker for email notifications",
      inputSchema: AddContactInput,
    },
    async (args) => {
      const result = addContact(args as AddContactInputType);
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
