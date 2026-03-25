/**
 * Connector message schemas — Zod definitions for the WebSocket protocol.
 *
 * Both apps/api (server-side WSS handler) and apps/connector (client-side)
 * import from this package. This is the single source of truth for the
 * connector communication protocol.
 *
 * Message types:
 *   HELLO    — authentication handshake (connector → cloud)
 *   COMMAND  — print dispatch command (cloud → connector)
 *   EVENT    — status update (connector → cloud)
 *   TELEMETRY — printer data (connector → cloud)
 *
 * All messages include:
 *   - type: discriminant field
 *   - version: protocol version (for forward compatibility)
 *   - messageId: UUID for deduplication and correlation
 *   - timestamp: ISO 8601 UTC
 */

import { z } from "zod";

// =============================================================================
// Shared primitives
// =============================================================================

const baseMessageSchema = z.object({
  /** Protocol version — increment when making breaking changes */
  version: z.literal("1").default("1"),
  /** UUID v4 — used for deduplication and command correlation */
  messageId: z.string().uuid(),
  /** ISO 8601 UTC timestamp */
  timestamp: z.string().datetime(),
});

// =============================================================================
// HELLO — Connector authentication handshake (connector → cloud)
// =============================================================================

export const helloMessageSchema = baseMessageSchema.extend({
  type: z.literal("HELLO"),
  /** Connector device ID */
  connectorId: z.string().uuid(),
  /** Signed enrollment token or rotating credential */
  credential: z.string().min(1),
  /** Connector software version */
  softwareVersion: z.string().min(1),
  /** List of connected printer serial numbers */
  printerSerials: z.array(z.string()),
});

export type HelloMessage = z.infer<typeof helloMessageSchema>;

// =============================================================================
// HELLO_ACK — Server acknowledgment of HELLO (cloud → connector)
// =============================================================================

export const helloAckSchema = baseMessageSchema.extend({
  type: z.literal("HELLO_ACK"),
  /** Echoes the messageId from the HELLO message */
  correlationId: z.string().uuid(),
  /** Whether the connector was accepted */
  accepted: z.boolean(),
  /** Rejection reason if not accepted */
  rejectionReason: z.string().optional(),
  /** Permitted scopes for this connector session */
  scopes: z.array(z.string()),
});

export type HelloAck = z.infer<typeof helloAckSchema>;

// =============================================================================
// COMMAND — Print dispatch command (cloud → connector)
// =============================================================================

export const commandMessageSchema = baseMessageSchema.extend({
  type: z.literal("COMMAND"),
  /** Print job ID from the platform database */
  printJobId: z.string().uuid(),
  /** Target printer serial number */
  printerSerial: z.string().min(1),
  /** Pre-signed URL for the .3mf project file */
  projectFileUrl: z.string().url(),
  /** Command expiry — connector must reject expired commands */
  expiresAt: z.string().datetime(),
  /** Admin who approved this dispatch */
  approvedBy: z.string().uuid(),
});

export type CommandMessage = z.infer<typeof commandMessageSchema>;

// =============================================================================
// COMMAND_ACK — Connector acknowledges command receipt (connector → cloud)
// =============================================================================

export const commandAckSchema = baseMessageSchema.extend({
  type: z.literal("COMMAND_ACK"),
  correlationId: z.string().uuid(),
  printJobId: z.string().uuid(),
  accepted: z.boolean(),
  rejectionReason: z.string().optional(),
});

export type CommandAck = z.infer<typeof commandAckSchema>;

// =============================================================================
// EVENT — Status updates (connector → cloud)
// =============================================================================

export const eventTypeSchema = z.enum([
  "PRINT_STARTED",
  "PRINT_LAYER_PROGRESS",
  "PRINT_COMPLETED",
  "PRINT_FAILED",
  "PRINTER_OFFLINE",
  "PRINTER_ONLINE",
  "PRINTER_ERROR",
]);

export type EventType = z.infer<typeof eventTypeSchema>;

export const eventMessageSchema = baseMessageSchema.extend({
  type: z.literal("EVENT"),
  eventType: eventTypeSchema,
  printJobId: z.string().uuid().optional(),
  printerSerial: z.string().min(1),
  payload: z
    .object({
      /** 0-100 progress percentage (PRINT_LAYER_PROGRESS) */
      progressPercent: z.number().min(0).max(100).optional(),
      /** Current layer (PRINT_LAYER_PROGRESS) */
      currentLayer: z.number().int().optional(),
      /** Total layers (PRINT_LAYER_PROGRESS) */
      totalLayers: z.number().int().optional(),
      /** Error code (PRINT_FAILED, PRINTER_ERROR) */
      errorCode: z.string().optional(),
      /** Human-readable error message */
      errorMessage: z.string().optional(),
    })
    .optional(),
});

export type EventMessage = z.infer<typeof eventMessageSchema>;

// =============================================================================
// TELEMETRY — Printer sensor data (connector → cloud)
// =============================================================================

export const telemetryMessageSchema = baseMessageSchema.extend({
  type: z.literal("TELEMETRY"),
  printerSerial: z.string().min(1),
  data: z.object({
    /** Nozzle temperature in °C */
    nozzleTempC: z.number().optional(),
    /** Bed temperature in °C */
    bedTempC: z.number().optional(),
    /** Chamber temperature in °C (if available) */
    chamberTempC: z.number().optional(),
    /** Fan speed 0-100% */
    fanSpeedPercent: z.number().min(0).max(100).optional(),
    /** Print speed percentage of target */
    printSpeedPercent: z.number().optional(),
    /** Remaining filament estimate in grams */
    filamentRemainingGrams: z.number().optional(),
  }),
});

export type TelemetryMessage = z.infer<typeof telemetryMessageSchema>;

// =============================================================================
// Union type — discriminated union of all connector messages
// =============================================================================

export const connectorMessageSchema = z.discriminatedUnion("type", [
  helloMessageSchema,
  helloAckSchema,
  commandMessageSchema,
  commandAckSchema,
  eventMessageSchema,
  telemetryMessageSchema,
]);

export type ConnectorMessage = z.infer<typeof connectorMessageSchema>;
