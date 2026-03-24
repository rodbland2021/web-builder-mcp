# web-builder-mcp

MCP server that turns client briefs into production-quality websites with e-commerce, booking systems, automated testing, and deployment to Cloudflare.

## Features

- 16 MCP tools: discover → research → plan → review → build → enhance → test → deploy
- Auto-generated unit tests (Vitest), E2E tests (Playwright), and visual verification tests
- CSS custom properties, semantic HTML, WCAG AA accessibility, mobile-first responsive
- E-commerce via Stripe + Cloudflare Workers ($0/mo hosting)
- Booking forms, contact forms, gallery components
- 6 automated quality gates

## Install

```bash
npm install -g web-builder-mcp
```

## Config

```bash
# Add to your AI agent's MCP server config:
{
  "web-builder-mcp": {
    "command": "npx",
    "args": ["web-builder-mcp"]
  }
}
```

## License

MIT
