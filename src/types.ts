import { z } from "zod";

export const ConfigSchema = z.object({
  cloudflare: z
    .object({
      apiKey: z.string().default(""),
      email: z.string().default(""),
      accountId: z.string().default(""),
    })
    .default({}),
  stripe: z
    .object({
      testKey: z.string().default(""),
      liveKey: z.string().default(""),
      webhookSecret: z.string().default(""),
    })
    .default({}),
  defaults: z
    .object({
      currency: z.string().default("USD"),
      timezone: z.string().default("UTC"),
      language: z.string().default("en-US"),
    })
    .default({}),
  google: z.object({ apiKey: z.string().default("") }).default({}),
  unsplash: z.object({ accessKey: z.string().default("") }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface Palette {
  bg: string;
  bgAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryDark: string;
  accent: string;
  surface: string;
  border: string;
}

export interface ImageProvider {
  name: string;
  generate(prompt: string, outputPath: string): Promise<string>;
}

export interface ImageResult {
  imagesGenerated: number;
  imageProvider: string;
  estimatedImageCost: string;
}
