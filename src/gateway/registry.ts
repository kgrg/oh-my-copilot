/**
 * Connector registry — the seam where new connectors plug in. Today: slack
 * only. To add Telegram/Discord/etc, register a factory here, drop a file
 * under src/gateway/connectors/, and the CLI `--only <name>` picks it up.
 */
import type { Connector, ConnectorDoctor } from "./connector.js";
import { createSlackConnector, slackDoctor, SLACK_CONNECTOR_NAME } from "./connectors/slack.js";
import { loadSlackConfig } from "../slack/config.js";

export interface RegistryDeps {
  /** Env overrides for tests; default reads process.env. */
  env?: NodeJS.ProcessEnv;
}

export interface BuiltConnectors {
  /** Live connectors to be started by the gateway runtime. */
  connectors: Connector[];
  /** Doctor probes — one per *potential* connector, started or not. */
  doctors: ConnectorDoctor[];
  /** Warnings encountered while building the registry (e.g. missing tokens). */
  warnings: string[];
}

/**
 * Build the set of connectors that should run given the current env. A
 * connector that lacks its required env vars is reported as a doctor probe
 * (so `gateway status` can show the gap) but is NOT added to `connectors`.
 *
 * `enabledNames` (from `--only`) further filters the set; passing undefined
 * means "all auto-detected".
 */
export function buildConnectors(
  enabledNames: string[] | undefined,
  deps: RegistryDeps = {},
): BuiltConnectors {
  const env = deps.env ?? process.env;
  const warnings: string[] = [];
  const connectors: Connector[] = [];
  const doctors: ConnectorDoctor[] = [];

  // --- slack ---
  const slackEnabled = enabledNames ? enabledNames.includes(SLACK_CONNECTOR_NAME) : true;
  if (slackEnabled) {
    let slackCfg = null;
    let slackErr: string | undefined;
    try {
      slackCfg = loadSlackConfig(undefined, env);
    } catch (err) {
      slackErr = err instanceof Error ? err.message : String(err);
      warnings.push(`slack: ${slackErr}`);
    }
    if (slackCfg) {
      connectors.push(createSlackConnector({ config: slackCfg }));
    }
    doctors.push(slackDoctor(slackCfg, slackErr));
  }

  return { connectors, doctors, warnings };
}

/** Known connector names — used for `--only` validation messages. */
export const KNOWN_CONNECTORS: readonly string[] = [SLACK_CONNECTOR_NAME];
