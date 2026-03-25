/**
 * Storefront service environment validation schema.
 */

import { z } from "zod";

const storefrontEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type StorefrontEnv = z.infer<typeof storefrontEnvSchema>;

export function parseStorefrontEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorefrontEnv {
  const result = storefrontEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Storefront environment validation failed:\n${errors}`);
  }
  return result.data;
}
