/**
 * Connector service environment validation schema.
 */

import { z } from "zod";

const connectorEnvSchema = z.object({
  CONNECTOR_WSS_URL: z.string().url().describe("WebSocket URL to dial into"),
  CONNECTOR_ENROLLMENT_SECRET: z
    .string()
    .min(32)
    .describe("Secret for validating enrollment tokens"),
  CONNECTOR_AUTH_MAX_ATTEMPTS: z.coerce.number().int().positive().default(10),
  CONNECTOR_AUTH_BLOCK_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
});

export type ConnectorEnv = z.infer<typeof connectorEnvSchema>;

export function parseConnectorEnv(
  env: NodeJS.ProcessEnv = process.env,
): ConnectorEnv {
  const result = connectorEnvSchema.safeParse(env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Connector environment validation failed:\n${errors}`);
  }
  return result.data;
}
