/**
 * Worker service environment validation schema.
 */

import { z } from "zod";

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_UPLOADS: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  DEPLOYMENT_MODE: z.enum(["saas", "self-hosted"]).default("saas"),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(
  env: NodeJS.ProcessEnv = process.env,
): WorkerEnv {
  const result = workerEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Worker environment validation failed:\n${errors}`);
  }
  return result.data;
}
