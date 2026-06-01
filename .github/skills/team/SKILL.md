---
name: team
description: Split an approved plan into parallel tmux panes, each running an independent Copilot CLI agent. Use when work has independent lanes and you want visual parallel execution in split terminals. Use when user says /team, team, or wants parallel agent execution.
argument-hint: "<number of workers> <task description>"
---

# Team — tmux-based parallel agent execution

`/team` launches independent Copilot CLI agents in parallel tmux panes. Two modes available:

| Mode | Command | Panes visible in | Best for |
|------|---------|-------------------|----------|
| **Runtime** | `omp team N:copilot "task"` | Separate tmux session | Task tracking, nudging, messaging |
| **Split** | `team-launch.sh` | Current window | Visual demo, watching agents work |

## When to use

- Work has **independent lanes** (no shared files, no ordering constraints)
- You want parallel execution in split terminals

## Mode 1 — Runtime (`omp team`)

### Launch

```bash
omp team <N>:copilot "<task description>"
```

The runtime automatically:
1. Creates a tmux session with split panes
2. Launches `copilot --allow-all-tools` in each pane
3. Auto-accepts folder trust prompts
4. Waits for readiness, then sends the task prompt
5. Tracks task state, heartbeats, and supports idle-nudging

### Monitor and cleanup

```bash
omp team status <team-name>       # check progress
tmux attach -t omp-team-<name>    # watch panes live
omp team shutdown <team-name>     # kill when done
```

## Mode 2 — Split window (`team-launch.sh`)

Use when you want agents **visible in your current window**.

### Step 1 — Write lanes JSON

Write a temporary file at `/tmp/team-lanes-<timestamp>.json`:

```json
[
  { "id": "lane-a", "name": "Short name", "prompt": "Complete self-contained task prompt..." },
  { "id": "lane-b", "name": "Another lane", "prompt": "Another task prompt..." }
]
```

### Step 2 — Launch

```bash
bash ~/.copilot/installed-plugins/oh-my-copilot/oh-my-copilot/.github/skills/team/scripts/team-launch.sh \
  --session "team-<name>" --lanes <lanes-file>
```

The script:
1. Splits the **current window** into panes
2. Launches `omp --madmax` in each
3. Auto-accepts folder trust prompts
4. Waits for readiness, sends prompts
5. Monitors completion and prints a results summary

### Step 3 — Report

The script blocks and prints all results. Relay the output to the user.

## Prerequisites

- `tmux` installed and session running
- `omp` on PATH
- `jq` for JSON parsing (split mode only)

## Task / prompt guidelines

Each task must be **self-contained**. The agent has no context from this session. Include:
- Exact files or directories to work in
- What to do (fix, upgrade, etc.)
- How to verify (run tests, etc.)
- Commit message to use

### Good example

> In src/auth/login.ts, replace bcrypt with argon2. Update the import, change the verify call, run `npm test -- --grep auth`. Commit: "refactor: switch to argon2".

### Bad example

> Fix the auth module. (Too vague)

## Composition

Use `/ralplan` before `/team` to produce the plan. Use `/verify` after completion.

## Limitations

- Each pane is an independent session — no shared state
- Workers can message each other via `omp team api send-message` (runtime mode only)
- If tasks depend on each other, use `/ralph` instead
