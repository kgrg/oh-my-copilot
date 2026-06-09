/**
 * A Gateway Connector is a long-lived event source that the gateway runtime
 * starts, watches for readiness, and stops cleanly on shutdown. Connectors are
 * intentionally tiny: name + lifecycle + status snapshot. All transport-specific
 * concerns (Bolt, HTTP, MCP, etc.) live inside the connector implementation.
 *
 * Why not just call `runSlackBot()`? Adding a second connector later (Telegram,
 * Discord, webhook) becomes one file implementing this interface, not a new
 * top-level command and a new lifecycle.
 */

export interface ConnectorStatus {
  /** True when the connector is connected and ready to handle events. */
  ready: boolean;
  /** Optional human-readable detail — error message, "not started", etc. */
  detail?: string;
}

export interface Connector {
  /** Stable identifier, e.g. "slack". Used for `--only` filtering and status output. */
  readonly name: string;
  /** Open whatever long-lived resources are needed (sockets, listeners). */
  start(): Promise<void>;
  /** Close cleanly. Must be idempotent — calling stop() twice is a no-op. */
  stop(): Promise<void>;
  /** Synchronous readiness snapshot — never opens sockets or makes I/O calls. */
  status(): ConnectorStatus;
}

/**
 * Static (no-I/O) readiness check for the doctor command. Connectors expose
 * this so `omp gateway status` can answer "is this startable?" without
 * actually starting it.
 */
export interface ConnectorDoctor {
  /** Same name as the Connector. */
  readonly name: string;
  /** Returns a snapshot reporting whether start() would currently succeed. */
  doctor(): ConnectorStatus;
}
