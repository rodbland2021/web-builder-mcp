import { z } from "zod";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

  // --- contact.html ---
  const contactHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Contact ${businessName}">
  <title>Contact — ${businessName}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <a href="#main" class="skip-link">Skip to content</a>

  <main id="main">
    <div class="page-header">
      <div class="container">
        <h1>Contact ${businessName}</h1>
        <p>We'd love to hear from you. Send us a message and we'll get back to you shortly.</p>
      </div>
    </div>

    <section class="section">
      <div class="container">
        <div style="max-width:600px;margin-inline:auto;">
          <p class="required-note"><span class="required-star">*</span> Required fields</p>
          <form id="contact-form" novalidate>
            <div class="form-group">
              <label for="contact-name">Full name <span class="required-star" aria-label="required">*</span></label>
              <input
                type="text"
                id="contact-name"
                name="name"
                required
                autocomplete="name"
                placeholder="Your full name"
                aria-required="true"
              >
            </div>
            <div class="form-group">
              <label for="contact-email">Email address <span class="required-star" aria-label="required">*</span></label>
              <input
                type="email"
                id="contact-email"
                name="email"
                required
                autocomplete="email"
                placeholder="you@example.com"
                aria-required="true"
              >
            </div>
            <div class="form-group">
              <label for="contact-phone">Phone number</label>
              <input
                type="tel"
                id="contact-phone"
                name="phone"
                autocomplete="tel"
                placeholder="Optional"
              >
            </div>
            <div class="form-group">
              <label for="contact-message">Message <span class="required-star" aria-label="required">*</span></label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows="5"
                placeholder="How can we help you?"
                aria-required="true"
              ></textarea>
            </div>
            <div id="contact-error" role="alert" style="color:#dc2626;margin-bottom:var(--spacing-md);display:none;"></div>
            <div id="contact-success" role="status" style="color:#16a34a;margin-bottom:var(--spacing-md);display:none;">
              Thank you! Your message has been sent. We'll be in touch soon.
            </div>
            <button type="submit" class="btn btn-primary">Send message</button>
          </form>
        </div>
      </div>
    </section>
  </main>

  <script src="site.js" defer></script>
  <script>
  (function () {
    document.getElementById('contact-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('contact-error');
      const successEl = document.getElementById('contact-success');
      const btn = this.querySelector('button[type="submit"]');

      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const phone = document.getElementById('contact-phone').value.trim();
      const message = document.getElementById('contact-message').value.trim();

      if (!name || !email || !message) {
        errorEl.textContent = 'Please fill in all required fields.';
        errorEl.style.display = 'block';
        return;
      }

      errorEl.style.display = 'none';
      btn.disabled = true;

      try {
        const res = await fetch('/workers/contact-api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, message }),
        });
        const data = await res.json();
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
  </script>
</body>
</html>`;
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
