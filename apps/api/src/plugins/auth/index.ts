/**
 * Auth plugin — session validation and request decoration.
 *
 * This Fastify plugin reads the session cookie on every request and
 * populates request.sessionData if a valid session exists.
 *
 * Session lifetime rules enforced here:
 *   - Customer sessions: SESSION_TTL_SECONDS (default 7 days), sliding window
 *   - Admin sessions: ADMIN_SESSION_TTL_SECONDS (default 8 hours), shorter TTL
 *     plus an inactivity timeout enforced in the RBAC requireAdmin preHandler.
 *
 * The plugin does NOT reject unauthenticated requests — routes declare their
 * own requirements via RBAC preHandlers (requireAuth, requirePermission, etc.).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Redis } from "ioredis";
import { getSession } from "../../services/session/index.js";
import { touchSession } from "../../services/session/index.js";

// Cookie name matches the one set in auth routes
const SESSION_COOKIE_NAME = "sid";

interface AuthPluginOptions {
  redis: Redis;
  sessionTtlSeconds: number;
  adminSessionTtlSeconds: number;
}

export async function authPlugin(
  fastify: FastifyInstance,
  opts: AuthPluginOptions,
): Promise<void> {
  const { redis, sessionTtlSeconds, adminSessionTtlSeconds } = opts;

  // Decorate request with sessionData (undefined if not authenticated)
  fastify.decorateRequest("sessionData", null);

  fastify.addHook(
    "preHandler",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const sessionToken = request.cookies[SESSION_COOKIE_NAME];
      if (!sessionToken) {
        return;
      }

      const session = await getSession(redis, sessionToken);
      if (!session) {
        return;
      }

      // Attach session data to the request
      request.sessionData = session;

      // Slide the session TTL on activity (admin sessions use shorter TTL)
      const ttl = session.isAdmin ? adminSessionTtlSeconds : sessionTtlSeconds;
      await touchSession(redis, sessionToken, ttl);
    },
  );
}
