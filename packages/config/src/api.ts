/**
 * API service environment validation schema.
 *
 * Validates all environment variables required by apps/api on startup.
 * Missing or malformed vars cause a clear startup error before any
 * service initializes. This is the package's primary responsibility.
 */

import { z } from "zod";

const apiEnvSchema = z.object({
  // Database
  DATABASE_URL: z
    .string()
    .url()
    .describe("Application DB URL (via PgBouncer — enforces RLS via app_user)"),
  DIRECT_DATABASE_URL: z
    .string()
    .url()
    .describe("Direct DB URL for migrations (bypasses PgBouncer)"),

  // Redis
  REDIS_URL: z
    .string()
    .url()
    .describe("Redis URL for BullMQ and session cache"),

  // Auth
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .describe("Cookie signing secret — generate with: openssl rand -hex 32"),
  CSRF_SECRET: z
    .string()
    .min(32, "CSRF_SECRET must be at least 32 characters")
    .describe("CSRF token secret"),
  COOKIE_DOMAIN: z.string().optional(),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),

  // Object Storage
  S3_ENDPOINT: z.string().url().describe("S3-compatible endpoint URL"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_UPLOADS: z.string().min(1),
  S3_BUCKET_INVOICES: z.string().min(1),
  S3_BUCKET_ASSETS: z.string().min(1),
  S3_PRESIGNED_URL_TTL: z.coerce.number().int().positive().default(900),

  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .startsWith("sk_", "Stripe secret key must start with sk_"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .startsWith("whsec_", "Stripe webhook secret must start with whsec_"),

  // PayPal
  PAYPAL_CLIENT_ID: z.string().min(1),
  PAYPAL_CLIENT_SECRET: z.string().min(1),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),

  // Email
  EMAIL_FROM: z.string().email(),
  EMAIL_FROM_NAME: z.string().default("PLAground"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  // Connector
  CONNECTOR_ENROLLMENT_SECRET: z
    .string()
    .min(32, "CONNECTOR_ENROLLMENT_SECRET must be at least 32 characters"),

  // Service config
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  API_PUBLIC_URL: z.string().url(),
  DEPLOYMENT_MODE: z.enum(["saas", "self-hosted"]).default("saas"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Parse and validate API environment variables.
 * Throws a ZodError with a clear message if any required vars are missing.
 *
 * Call this at the top of the API server entrypoint before any initialization.
 */
export function parseApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `API environment validation failed:\n${errors}\n\nCheck .env.example for required variables.`,
    );
  }

  return result.data;
}
