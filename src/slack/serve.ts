/**
 * Thin wrapper that runs ONLY the Slack connector via the gateway runtime.
 * Kept so `omp slack serve` (CLI alias) and any external callers of
 * `runSlackBot()` keep working after the gateway refactor. All real lifecycle
 * logic now lives in src/gateway/runtime.ts + src/gateway/connectors/slack.ts.
 */
import type { SlackConfig } from "./config.js";
import { createSlackConnector } from "../gateway/connectors/slack.js";
import { runGateway } from "../gateway/runtime.js";

export async function runSlackBot(config: SlackConfig): Promise<void> {
  const connector = createSlackConnector({ config });
  await runGateway({ connectors: [connector] });
}
