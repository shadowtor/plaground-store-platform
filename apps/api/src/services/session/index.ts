/**
 * Session service — thin layer over Redis session operations.
 *
 * Re-exports key session functions from the auth service so other
 * parts of the API (e.g., auth plugin) can import from a stable path
 * without coupling to auth service internals.
 *
 * Session lifetime rules:
 *   - Customer sessions: SESSION_TTL_SECONDS (default 7 days)
 *   - Admin sessions: ADMIN_SESSION_TTL_SECONDS (default 8 hours) with
 *     an additional inactivity timeout enforced in the RBAC plugin.
 */

export {
  createSession,
  getSession,
  type SessionData,
} from "../auth/index.js";

import type { Redis } from "ioredis";
import type { SessionData } from "../auth/index.js";

const SESSION_PREFIX = "session:";

/**
 * Refresh the session TTL on activity (sliding window).
 * Called by the auth plugin on each authenticated request.
 */
export async function touchSession(
  redis: Redis,
  sessionToken: string,
  ttlSeconds: number,
): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionToken}`;
  const raw = await redis.get(key);
  if (!raw) return;

  // Update lastActiveAt and reset TTL
  const data = JSON.parse(raw) as SessionData;
  data.lastActiveAt = new Date().toISOString();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

/**
 * Destroy a session immediately.
 */
export async function destroySession(
  redis: Redis,
  sessionToken: string,
): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${sessionToken}`);
}

/**
 * Check if a session has exceeded the admin inactivity timeout.
 *
 * Admin sessions use a shorter absolute TTL, but also enforce an
 * inactivity timeout (e.g., 30 minutes idle = session terminated).
 *
 * @param inactivityTimeoutSeconds - Max seconds of inactivity (default 1800 = 30 min)
 */
export function isAdminSessionExpiredByInactivity(
  session: SessionData,
  inactivityTimeoutSeconds = 1800,
): boolean {
  const lastActive = new Date(session.lastActiveAt).getTime();
  const now = Date.now();
  return now - lastActive > inactivityTimeoutSeconds * 1000;
}
