/**
 * Fastify type augmentations.
 *
 * Extends the FastifyRequest interface with properties injected by plugins:
 *   - tenantId: resolved by the tenant-resolution plugin (preHandler)
 *   - sessionData: resolved by the auth plugin (preHandler)
 */

import type { SessionData } from "../services/session/index.js";

declare module "fastify" {
  interface FastifyRequest {
    /**
     * The resolved tenant ID for this request.
     * Set by the tenant-resolution plugin via the request's hostname or path prefix.
     */
    tenantId: string;

    /**
     * The authenticated session data, if the user is logged in.
     * Set by the auth plugin after verifying the session cookie.
     * Undefined for unauthenticated requests.
     */
    sessionData?: SessionData;
  }
}
