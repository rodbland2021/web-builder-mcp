/**
 * Shared utility for reading site files from a directory.
 * Used by review_site, seo_audit, and ada_check tools.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, extname } from "path";

export interface SiteFile {
  path: string;
  content: string;
}

export interface SiteFiles {
  htmlFiles: SiteFile[];
  cssFiles: SiteFile[];
  jsFiles: SiteFile[];
}

function readFilesWithExt(dir: string, ext: string): SiteFile[] {
  if (!existsSync(dir)) return [];
  const results: SiteFile[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && extname(entry.name).toLowerCase() === ext) {
        const filePath = join(dir, entry.name);
        try {
          const content = readFileSync(filePath, "utf-8");
          results.push({ path: entry.name, content });
        } catch {
          // Skip unreadable files
        }
      } else if (entry.isDirectory() && entry.name !== "node_modules") {
        const subResults = readFilesWithExt(join(dir, entry.name), ext);
        for (const f of subResults) {
          results.push({ path: join(entry.name, f.path), content: f.content });
        }
      }
    }
  } catch {
    // Ignore directory read errors
  }
  return results;
}

export function readSiteFiles(siteDir: string): SiteFiles {
  return {
    htmlFiles: readFilesWithExt(siteDir, ".html"),
    cssFiles: readFilesWithExt(siteDir, ".css"),
    jsFiles: readFilesWithExt(siteDir, ".js"),
  };
}
