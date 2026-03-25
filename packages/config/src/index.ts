/**
 * packages/config — Zod-based environment validation per service.
 *
 * Each service imports only its own validation schema.
 * Missing or malformed vars cause a clear startup error.
 */

export { parseApiEnv, type ApiEnv } from "./api.js";
export { parseWorkerEnv, type WorkerEnv } from "./worker.js";
export { parseStorefrontEnv, type StorefrontEnv } from "./storefront.js";
export { parseAdminEnv, type AdminEnv } from "./admin.js";
export { parseConnectorEnv, type ConnectorEnv } from "./connector.js";
