/**
 * OpenAPI contract types scaffold.
 *
 * These types will be generated from the OpenAPI spec via `pnpm contracts:generate`.
 * The generation script reads the OpenAPI spec from apps/api and outputs TypeScript
 * types using openapi-typescript.
 *
 * Web apps and the connector import ONLY from packages/contracts — never from
 * apps/api source directly. This enforces the contract boundary.
 *
 * Generation command: pnpm contracts:generate
 * Output: src/generated/openapi.ts (generated — do not edit manually)
 */

// Re-export generated types (populated after first contracts:generate run)
// export * from './generated/openapi.js';

/**
 * Placeholder types until code generation is wired up in a later plan.
 * These will be replaced by generated types from the OpenAPI spec.
 */

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor?: string;
  hasMore: boolean;
  total?: number;
}
