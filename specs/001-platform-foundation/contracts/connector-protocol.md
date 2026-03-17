# Connector Protocol: PLAground ↔ Local BambuLab Connector

**Goals**:

- No printers exposed to the public internet.
- Strong authentication and encryption for all connector communications.
- Least-privilege command execution with audit logging.
- Safe offline behavior and recovery.
- Platform can “initiate” actions (settings/healthchecks/dispatch) without requiring inbound ports.

## Trust model and connectivity

### Recommended connectivity pattern

- The connector establishes an outbound, long-lived encrypted channel to the platform (e.g., WSS).
- The platform sends commands over that channel.
- This achieves platform-initiated actions while keeping the connector behind NAT/firewalls.

### Alternative: optional tunnel

- Optional outbound tunnel (e.g., cloudflared) MAY be used if the deployment environment requires it.
- This must remain optional to avoid hard lock-in.

## Connector identity and provisioning

### Bootstrap

- Connectors are created in the platform by an admin (or via an admin-approved bootstrap flow).
- Bootstrap returns a time-limited enrollment token.
- Connector exchanges enrollment token for long-lived credentials (rotatable).

### Credentials and rotation

- Connector credentials MUST be scoped to connector actions only.
- Credentials MUST be rotatable without taking the whole platform down.
- Rotation MUST invalidate prior credentials after a grace period.

### Least privilege

Connector permissions are scoped (examples):

- `connector.heartbeat.write`
- `connector.telemetry.write`
- `connector.command.receive`
- `connector.command.ack`

## Anti-abuse protections

Both platform and connector enforce:

- rate limiting
- exponential backoff on failures
- automated temporary blocking/bans for repeated unauthorized attempts (Fail2Ban-like behavior)
- audit logs for failed authentication and command rejections

## Channel behaviors

### Heartbeat

- Connector sends heartbeat at a fixed cadence (e.g., every 15–60 seconds).
- Heartbeat includes: connector version, uptime, resource usage summary, known printers status summary.

### Telemetry

- Telemetry is sent as events with:
  - a monotonic sequence number
  - server-issued correlation IDs when responding to commands
  - timestamps from connector and server (when available)

### Command lifecycle (admin-approved printing)

Policy:

- Printing MUST NOT start until admin approves dispatch.
- Connector MUST reject any print-start command that is not explicitly approved.

Lifecycle:

1. Platform creates a `PrintJob` and queues it (prepared/queued/awaiting_admin_approval).
2. Admin assigns printer/material readiness and approves dispatch.
3. Platform sends `DispatchPrintJob` command to connector over the channel.
4. Connector validates:
   - command signature/auth
   - authorization scope
   - idempotency key
   - “approved” flag and approval timestamp
   - target printer belongs to connector
5. Connector acknowledges receipt.
6. Connector executes and streams progress events.
7. Connector reports completion/failure with structured outcome.

### Idempotency and replay protection

- Commands include `commandId` + `idempotencyKey`.
- Connector stores a bounded history of processed command IDs to avoid replay.
- Commands are signed and time-bounded (e.g., expiresAt).

### Error handling and safe failures

Connector MUST:

- fail closed on auth failures
- reject unknown commands
- refuse to proceed on partial data
- emit clear failure events for admin triage

## Messages (logical shapes)

These are conceptual shapes; exact JSON schema should be implemented and tested.

### Connector → Platform

- `Heartbeat`
- `TelemetryEvent`
- `CommandAck`
- `CommandResult`
- `ConnectorLogEvent` (optional, redacted)

### Platform → Connector

- `HealthCheck`
- `UpdateSettings`
- `ListPrinters`
- `DispatchPrintJob` (requires admin approval)
- `CancelPrintJob` (safe cancellation semantics)

## Offline behavior and recovery

- Connector queues outbound events locally when offline.
- Platform marks connector offline/degraded based on missed heartbeats.
- Platform MUST NOT dispatch when connector is offline.
- On reconnect, connector replays queued events with sequence numbers.

