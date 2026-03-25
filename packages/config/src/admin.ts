/**
 * Admin service environment validation schema.
 */

import { z } from "zod";

const adminEnvSchema = z.object({
  NEXT_PUBLIC_ADMIN_API_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AdminEnv = z.infer<typeof adminEnvSchema>;

export function parseAdminEnv(
  env: NodeJS.ProcessEnv = process.env,
): AdminEnv {
  const result = adminEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Admin environment validation failed:\n${errors}`);
  }
  return result.data;
}
