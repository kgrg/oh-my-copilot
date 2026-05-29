import { mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  launchCopilot,
  normalizeCopilotLaunchArgs,
  resolveCopilotBin,
} from "../../src/copilot/launch.js";

describe("resolveCopilotBin", () => {
  it("uses explicit override when provided", () => {
    expect(resolveCopilotBin("/usr/local/bin/copilot")).toBe("/usr/local/bin/copilot");
  });

  it("falls back to OMC_COPILOT_BIN env", () => {
    const original = process.env.OMC_COPILOT_BIN;
    process.env.OMC_COPILOT_BIN = "/env/copilot";
    try {
      expect(resolveCopilotBin()).toBe("/env/copilot");
    } finally {
      if (original === undefined) delete process.env.OMC_COPILOT_BIN;
      else process.env.OMC_COPILOT_BIN = original;
    }
  });

  it("defaults to 'copilot'", () => {
    const original = process.env.OMC_COPILOT_BIN;
    delete process.env.OMC_COPILOT_BIN;
    try {
      expect(resolveCopilotBin()).toBe("copilot");
    } finally {
      if (original !== undefined) process.env.OMC_COPILOT_BIN = original;
    }
  });
});

describe("normalizeCopilotLaunchArgs", () => {
  it("passes args through unchanged when no bypass alias is present", () => {
    expect(normalizeCopilotLaunchArgs(["-p", "hello", "--agent", "planner"])).toEqual([
      "-p",
      "hello",
      "--agent",
      "planner",
    ]);
  });

  it("maps --madmax to --yolo and drops the original token", () => {
    expect(normalizeCopilotLaunchArgs(["--madmax", "-p", "hi"])).toEqual(["-p", "hi", "--yolo"]);
  });

  it("treats --yolo as an alias and strips duplicates", () => {
    expect(normalizeCopilotLaunchArgs(["--yolo", "--madmax"])).toEqual(["--yolo"]);
  });

  it("preserves an explicit --yolo and does not duplicate it when --madmax is also given", () => {
    expect(normalizeCopilotLaunchArgs(["--yolo", "-p", "go", "--madmax"])).toEqual([
      "--yolo",
      "-p",
      "go",
    ]);
  });

  it("leaves --allow-all alone (different copilot flag) but still maps --madmax", () => {
    expect(normalizeCopilotLaunchArgs(["--allow-all", "--madmax"])).toEqual([
      "--allow-all",
      "--yolo",
    ]);
  });

  it("does not treat --madmax=foo as the bypass flag (exact-token only)", () => {
    expect(normalizeCopilotLaunchArgs(["--madmax=foo", "-p", "hi"])).toEqual([
      "--madmax=foo",
      "-p",
      "hi",
    ]);
  });

  it("inserts --yolo before -- sentinel when bypass is requested in the pre-sentinel args", () => {
    expect(normalizeCopilotLaunchArgs(["--madmax", "--", "-p", "hi"])).toEqual([
      "--yolo",
      "--",
      "-p",
      "hi",
    ]);
  });

  it("passes tokens after -- through unchanged (no stripping, no normalization)", () => {
    expect(normalizeCopilotLaunchArgs(["--", "--madmax", "--yolo"])).toEqual([
      "--",
      "--madmax",
      "--yolo",
    ]);
  });

  it("dedups across --, keeping a single --yolo before the sentinel", () => {
    expect(normalizeCopilotLaunchArgs(["--yolo", "--madmax", "--", "echo", "ok"])).toEqual([
      "--yolo",
      "--",
      "echo",
      "ok",
    ]);
  });
});

describe("launchCopilot tmux wrapping", () => {
  // Black-box test (matching the real-spawn style of the suite below): use a
  // fake `tmux` on PATH that records its invocation, and a fake copilot bin.
  let dir: string;
  let tmuxLog: string;
  let fakeCopilot: string;
  const savedPath = process.env.PATH;
  const savedTmux = process.env.TMUX;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "omp-launch-"));
    tmuxLog = join(dir, "tmux-calls.txt");
    fakeCopilot = join(dir, "fake-copilot");
    // fake tmux: answer `-V` so tmuxAvailable() sees it, log everything else
    const fakeTmux = join(dir, "tmux");
    writeFileSync(
      fakeTmux,
      `#!/bin/sh\nif [ "$1" = "-V" ]; then echo "tmux 3.x-fake"; exit 0; fi\nprintf '%s\\n' "$*" >> ${tmuxLog}\nexit 0\n`,
    );
    chmodSync(fakeTmux, 0o755);
    writeFileSync(fakeCopilot, `#!/bin/sh\nprintf '%s' "$*" > ${join(dir, "copilot-args.txt")}\nexit 0\n`);
    chmodSync(fakeCopilot, 0o755);
    process.env.PATH = `${dir}:${savedPath}`;
  });

  afterEach(() => {
    if (savedPath === undefined) delete process.env.PATH;
    else process.env.PATH = savedPath;
    if (savedTmux === undefined) delete process.env.TMUX;
    else process.env.TMUX = savedTmux;
    rmSync(dir, { recursive: true, force: true });
  });

  it("wraps --madmax in a fresh tmux session and maps it to --yolo when not inside tmux", async () => {
    delete process.env.TMUX;
    const result = await launchCopilot({ args: ["--madmax", "probe"], bin: fakeCopilot, cwd: dir });
    expect(result.ok).toBe(true);
    const call = readFileSync(tmuxLog, "utf8").trim();
    expect(call).toMatch(/^new-session -s omp-\d+ -c /);
    expect(call).toContain(dir); // session opened in the requested cwd
    expect(call).toContain(`${fakeCopilot} probe --yolo`); // bypass mapped, bin invoked
  });

  it("launches directly (no tmux wrap) when already inside tmux", async () => {
    process.env.TMUX = "/tmp/fake,1234,0";
    const result = await launchCopilot({ args: ["--madmax", "probe"], bin: fakeCopilot, cwd: dir });
    expect(result.ok).toBe(true);
    expect(() => readFileSync(tmuxLog, "utf8")).toThrow(); // tmux never invoked
    expect(readFileSync(join(dir, "copilot-args.txt"), "utf8")).toBe("probe --yolo");
  });
});

describe("launchCopilot", () => {
  it("returns exit code 127 when the binary is missing", async () => {
    const result = await launchCopilot({ args: [], bin: "definitely-missing-xyz-binary" });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(127);
    expect(result.bin).toBe("definitely-missing-xyz-binary");
  });

  it("propagates exit code from the spawned binary", async () => {
    const result = await launchCopilot({ args: ["-c", "exit 3"], bin: "/bin/sh" });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(3);
  });
});
