import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { ConfigSchema } from "./types.js";
import type { Config } from "./types.js";

export type { Config };

const DEFAULT_CONFIG_DIR = join(homedir(), ".web-builder-mcp");

export async function loadConfig(configDir: string = DEFAULT_CONFIG_DIR): Promise<Config> {
  const configPath = join(configDir, "config.json");

  let raw: string;
  try {
    raw = await readFile(configPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      const defaults = ConfigSchema.parse({});
      await mkdir(configDir, { recursive: true });
      await writeFile(configPath, JSON.stringify(defaults, null, 2), "utf-8");
      return defaults;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${configPath}`);
  }

  return ConfigSchema.parse(parsed);
}
