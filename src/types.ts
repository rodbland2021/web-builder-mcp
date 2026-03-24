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
});

export type Config = z.infer<typeof ConfigSchema>;
