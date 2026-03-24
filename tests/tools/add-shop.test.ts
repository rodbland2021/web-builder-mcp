import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { addShop } from "../../src/tools/add-shop.js";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("addShop", () => {
  let siteDir: string;

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

  it("creates shop.html", () => {
    addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] });
    expect(existsSync(join(siteDir, "shop.html"))).toBe(true);
  });

  it("creates shop.css", () => {
    addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] });
    expect(existsSync(join(siteDir, "shop.css"))).toBe(true);
  });

  it("creates products.json", () => {
    addShop({ siteDir, products: [{ name: "Coffee Beans", price: 22 }] });
    const data = JSON.parse(readFileSync(join(siteDir, "products.json"), "utf-8"));
    expect(data[0].name).toBe("Coffee Beans");
    expect(data[0].price).toBe(22);
  });

  it("creates workers/shop-api directory with worker", () => {
    addShop({ siteDir, products: [{ name: "Test", price: 10 }] });
    expect(existsSync(join(siteDir, "workers", "shop-api", "index.js"))).toBe(true);
  });

  it("worker includes /health endpoint", () => {
    addShop({ siteDir, products: [{ name: "Test", price: 10 }] });
    const worker = readFileSync(join(siteDir, "workers", "shop-api", "index.js"), "utf-8");
    expect(worker).toContain("/health");
    expect(worker).toContain("/create-checkout");
  });

  it("returns list of created files", () => {
    const result = addShop({ siteDir, products: [{ name: "Test", price: 10 }] });
    expect(result.files).toContain("shop.html");
    expect(result.files).toContain("products.json");
  });
});
