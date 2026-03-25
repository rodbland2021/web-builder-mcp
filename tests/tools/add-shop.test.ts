import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addShop } from "../../src/tools/add-shop.js";
import { createMockProvider } from "../../src/tools/image-generator.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("addShop", () => {
  let siteDir: string;
  const mockProvider = createMockProvider();

  beforeEach(() => {
    siteDir = join(tmpdir(), `wbm-shop-${Date.now()}`);
    mkdirSync(siteDir, { recursive: true });
    // Create minimal existing site
    writeFileSync(join(siteDir, "styles.css"), ":root { --color-primary: #2563eb; }");
    writeFileSync(join(siteDir, "index.html"), "<html><body>Home</body></html>");
  });

  afterEach(() => {
    rmSync(siteDir, { recursive: true, force: true });
  });

  it("creates shop.html", async () => {
    await addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "shop.html"))).toBe(true);
  });

  it("creates shop.css", async () => {
    await addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "shop.css"))).toBe(true);
  });

  it("creates products.json", async () => {
    await addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] }, { imageProvider: mockProvider });
    const data = JSON.parse(readFileSync(join(siteDir, "products.json"), "utf-8"));
    expect(data[0].name).toBe("Coffee Beans");
    expect(data[0].price).toBe(22);
  });

  it("creates workers/shop-api directory with worker", async () => {
    await addShop({ siteDir, products: [{ name: "Test", price: 10 }] }, { imageProvider: mockProvider });
    expect(existsSync(join(siteDir, "workers", "shop-api", "index.js"))).toBe(true);
  });

  it("worker includes /health endpoint", async () => {
    await addShop({ siteDir, products: [{ name: "Test", price: 10 }] }, { imageProvider: mockProvider });
    const worker = readFileSync(join(siteDir, "workers", "shop-api", "index.js"), "utf-8");
    expect(worker).toContain("/health");
    expect(worker).toContain("/create-checkout");
  });

  it("returns list of created files", async () => {
    const result = await addShop({ siteDir, products: [{ name: "Test", price: 10 }] }, { imageProvider: mockProvider });
    expect(result.files).toContain("shop.html");
    expect(result.files).toContain("products.json");
  });

  it("creates images/product-{slug}.png for each product", async () => {
    await addShop(
      { siteDir, products: [{ name: "Coffee Beans", price: 22 }, { name: "Green Tea", price: 15 }] },
      { imageProvider: mockProvider }
    );
    expect(existsSync(join(siteDir, "images", "product-coffee-beans.png"))).toBe(true);
    expect(existsSync(join(siteDir, "images", "product-green-tea.png"))).toBe(true);
  });

  it("product cards reference generated images not emojis", async () => {
    await addShop(
      { siteDir, products: [{ name: "Coffee Beans", price: 22 }] },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('src="images/product-coffee-beans.png"');
    expect(html).not.toContain("🛍️");
  });

  it("returns imagesGenerated count", async () => {
    const result = await addShop(
      { siteDir, products: [{ name: "A", price: 10 }, { name: "B", price: 20 }] },
      { imageProvider: mockProvider }
    );
    expect(result.imagesGenerated).toBe(2);
  });

  it("returns imageProvider name", async () => {
    const result = await addShop(
      { siteDir, products: [{ name: "A", price: 10 }] },
      { imageProvider: mockProvider }
    );
    expect(result.imageProvider).toBe("mock");
  });

  it("products input has no image field", async () => {
    // Schema should accept products without image field (it was removed)
    const result = await addShop(
      { siteDir, products: [{ name: "Widget", price: 9.99, description: "A great widget", tags: ["new"] }] },
      { imageProvider: mockProvider }
    );
    expect(result.imagesGenerated).toBe(1);
  });

  it("image paths included in products.json LD+JSON", async () => {
    await addShop(
      { siteDir, products: [{ name: "Coffee Beans", price: 22 }] },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('"image": "images/product-coffee-beans.png"');
  });

  // --- SEO Feature 2: Product Offer Schema ---
  it("LD+JSON includes Offer block with price and priceCurrency (SEO-2)", async () => {
    await addShop(
      { siteDir, products: [{ name: "Coffee Beans", price: 22 }], currency: "AUD" },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('"@type": "Offer"');
    expect(html).toContain('"price": "22.00"');
    expect(html).toContain('"priceCurrency": "AUD"');
  });

  it("LD+JSON Offer includes InStock availability (SEO-2)", async () => {
    await addShop(
      { siteDir, products: [{ name: "Tea", price: 15 }] },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('"availability": "https://schema.org/InStock"');
  });

  it("LD+JSON uses provided currency code in Offer (SEO-2)", async () => {
    await addShop(
      { siteDir, products: [{ name: "Widget", price: 9.99 }], currency: "USD" },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('"priceCurrency": "USD"');
  });

  // --- M7: Shop page includes favicon ---
  it("shop.html includes favicon link (M7)", async () => {
    await addShop(
      { siteDir, products: [{ name: "Test", price: 10 }] },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain('rel="icon" href="favicon.svg"');
  });

  // --- S8: Shop preserves phone from index.html ---
  it("shop.html preserves phone number from index.html (S8)", async () => {
    const indexHtml = `<!DOCTYPE html>
<html lang="en-AU">
<head><title>Test</title></head>
<body>
  <header class="site-header">
    <div class="container nav-inner">
      <a href="index.html" class="nav-logo">Test Biz</a>
      <a href="tel:0412345678" class="nav-phone">0412 345 678</a>
      <nav><ul class="nav-links">
        <li><a href="index.html">Home</a></li>
      </ul></nav>
    </div>
  </header>
</body>
</html>`;
    writeFileSync(join(siteDir, "index.html"), indexHtml);
    await addShop(
      { siteDir, products: [{ name: "Test", price: 10 }] },
      { imageProvider: mockProvider }
    );
    const html = readFileSync(join(siteDir, "shop.html"), "utf-8");
    expect(html).toContain("nav-phone");
    expect(html).toContain("0412 345 678");
  });

  // --- M4: Shop updates sitemap ---
  it("shop updates existing sitemap.xml (M4)", async () => {
    // Create a sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>index.html</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
</urlset>
`;
    writeFileSync(join(siteDir, "sitemap.xml"), sitemap);
    await addShop(
      { siteDir, products: [{ name: "Test", price: 10 }] },
      { imageProvider: mockProvider }
    );
    const updatedSitemap = readFileSync(join(siteDir, "sitemap.xml"), "utf-8");
    expect(updatedSitemap).toContain("shop.html");
  });
});
