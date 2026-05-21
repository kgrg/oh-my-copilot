#!/usr/bin/env node
import { findCapability, loadCatalogBundle, validateCatalogBundle } from "./catalog.js";
import { inspectProject } from "./project.js";

interface CliResult {
  ok: boolean;
  exitCode?: number;
  output?: unknown;
  message?: string;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

function printResult(result: CliResult, json: boolean): void {
  if (json || typeof result.output === "object") {
    console.log(JSON.stringify(result.output ?? { ok: result.ok, message: result.message }, null, 2));
    return;
  }
  if (result.message) {
    console.log(result.message);
  }
}

function help(): string {
  return `oh-my-copilot\n\nCommands:\n  catalog list [--json]\n  catalog validate [--json]\n  catalog capability <id> [--json]\n  project inspect [--json]\n  lint:skills [--root <workspace>]\n  sync:dry-run [--root <workspace>]\n  jira:dry-run [--root <workspace>]\n`;
}

export async function runCli(argv = process.argv.slice(2)): Promise<CliResult> {
  const [group, command, value] = argv;
  const json = hasFlag(argv, "--json");

  if (!group || group === "help" || group === "--help" || group === "-h") {
    return { ok: true, message: help() };
  }

  if (group === "catalog") {
    if (command === "list") {
      const bundle = loadCatalogBundle();
      const output = bundle.capabilities.capabilities
        .filter((capability) => capability.phase1)
        .map((capability) => ({
          id: capability.id,
          command: `/${capability.defaultCommand}`,
          category: capability.category,
          phase1: capability.phase1,
          copilot: capability.providerSupport.copilot.state,
        }));
      return json ? { ok: true, output } : { ok: true, message: output.map((item) => `${item.id}\t${item.command}\t${item.copilot}`).join("\n") };
    }

    if (command === "validate") {
      const result = validateCatalogBundle();
      return {
        ok: result.ok,
        exitCode: result.ok ? 0 : 1,
        output: json ? result : undefined,
        message: result.ok ? "Catalog validation PASS" : `Catalog validation FAIL (${result.issues.length} issue(s))`,
      };
    }

    if (command === "capability" && value) {
      const capability = findCapability(value);
      if (!capability) {
        return { ok: false, exitCode: 1, output: json ? { ok: false, error: `Unknown capability: ${value}` } : undefined, message: `Unknown capability: ${value}` };
      }
      return json ? { ok: true, output: capability } : { ok: true, message: `${capability.id}: ${capability.summary}` };
    }
  }

  if (group === "project" && command === "inspect") {
    const output = inspectProject();
    return json ? { ok: true, output } : { ok: true, message: `packageRoot=${output.packageRoot}\nskillsRoot=${output.defaultSkillsRoot}\nhasCatalog=${output.hasCatalog}` };
  }

  if (group === "lint:skills") {
    const { lintSkills, formatLintIssues } = await import("./lint.js");
    const issues = lintSkills(flagValue(argv, "--root"));
    const ok = issues.filter((issue) => issue.level === "error").length === 0;
    return { ok, exitCode: ok ? 0 : 1, message: formatLintIssues(issues) };
  }

  if (group === "sync:dry-run") {
    const { formatDryRun } = await import("./sync.js");
    return { ok: true, message: formatDryRun() };
  }

  if (group === "jira:dry-run") {
    const jira = await import("./jira.js") as unknown as Record<string, any>;
    if (typeof jira.formatJiraDryRun === "function") {
      return { ok: true, message: jira.formatJiraDryRun() as string };
    }
    const config = typeof jira.discoverJiraConfig === "function" ? jira.discoverJiraConfig({ root: flagValue(argv, "--root") ?? ".." }) : undefined;
    const payloads = [
      typeof jira.createIssuePayload === "function" ? jira.createIssuePayload(config, { summary: "Phase 1 MVP tracking ticket", description: "Prepared by oh-my-copilot dry-run adapter." }) : undefined,
      typeof jira.commentPayload === "function" ? jira.commentPayload(config, "<ISSUE-KEY>", "Verification evidence goes here.") : undefined,
      typeof jira.safeUpdatePayload === "function" ? jira.safeUpdatePayload(config, "<ISSUE-KEY>", { labels: ["oh-my-copilot"] }) : undefined,
    ].filter(Boolean);
    return { ok: true, message: `PASS: Jira dry-run fallback payloads\n${JSON.stringify(payloads, null, 2)}` };
  }

  return { ok: false, exitCode: 1, message: `Unknown command.\n\n${help()}` };
}

const result = await runCli();
printResult(result, process.argv.includes("--json"));
process.exitCode = result.exitCode ?? (result.ok ? 0 : 1);
