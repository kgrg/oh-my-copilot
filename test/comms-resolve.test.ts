import { describe, it, expect } from "vitest";
import { makeTmux, type TmuxRunner, type TmuxApi } from "../src/team/tmux.js";
import { resolveSession, COPILOT_SESSION_RE } from "../src/comms/resolve-session.js";
import { runCli } from "../src/cli.js";

/**
 * Build a fake TmuxApi that returns a fixed list of session names from
 * `list-sessions` and responds to other commands generically.
 */
function fakeTmuxWithSessions(sessionNames: string[], listStatus = 0) {
  const runner: TmuxRunner = (args) => {
    if (args[0] === "list-sessions") {
      return {
        stdout: sessionNames.join("\n") + (sessionNames.length > 0 ? "\n" : ""),
        stderr: "",
        status: listStatus,
      };
    }
    return { stdout: "", stderr: "", status: 0 };
  };
  return makeTmux(runner);
}

describe("COPILOT_SESSION_RE", () => {
  it("AC9: matches a name produced by the launch scheme (omp-<timestamp>)", () => {
    const name = `omp-${Date.now()}`;
    expect(COPILOT_SESSION_RE.test(name)).toBe(true);
  });

  it("AC9: does not match omp-team-x", () => {
    expect(COPILOT_SESSION_RE.test("omp-team-x")).toBe(false);
  });

  it("does not match omp- with no digits", () => {
    expect(COPILOT_SESSION_RE.test("omp-")).toBe(false);
  });

  it("does not match omp-123abc (mixed suffix)", () => {
    expect(COPILOT_SESSION_RE.test("omp-123abc")).toBe(false);
  });

  it("does not match an unrelated session name", () => {
    expect(COPILOT_SESSION_RE.test("main")).toBe(false);
  });
});

describe("resolveSession", () => {
  describe("AC1: --session flag beats env", () => {
    it("returns flag value when both flag and env are provided", () => {
      const tmux = fakeTmuxWithSessions([]);
      const result = resolveSession({ flag: "omp-111", env: "omp-999", tmux });
      expect(result).toEqual({ ok: true, session: "omp-111", source: "flag" });
    });

    it("returns flag value when only flag is provided", () => {
      const tmux = fakeTmuxWithSessions([]);
      const result = resolveSession({ flag: "my-session", tmux });
      expect(result).toEqual({ ok: true, session: "my-session", source: "flag" });
    });
  });

  describe("AC2: env when no flag", () => {
    it("returns env value when flag is absent", () => {
      const tmux = fakeTmuxWithSessions([]);
      const result = resolveSession({ env: "omp-999", tmux });
      expect(result).toEqual({ ok: true, session: "omp-999", source: "env" });
    });

    it("returns env value when flag is an empty string", () => {
      const tmux = fakeTmuxWithSessions([]);
      const result = resolveSession({ flag: "", env: "omp-999", tmux });
      expect(result).toEqual({ ok: true, session: "omp-999", source: "env" });
    });
  });

  describe("AC4: exactly one omp-<digits> discovered", () => {
    it("resolves the single matching session with source=discovery", () => {
      const tmux = fakeTmuxWithSessions(["omp-1717171200000"]);
      const result = resolveSession({ tmux });
      expect(result).toEqual({
        ok: true,
        session: "omp-1717171200000",
        source: "discovery",
      });
    });
  });

  describe("AC5: zero matches", () => {
    it("returns ok:false with a remedy message when no sessions exist", () => {
      const tmux = fakeTmuxWithSessions([]);
      const result = resolveSession({ tmux });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/no running copilot session/);
        expect(result.error).toMatch(/omp/); // remedy mentions `omp`
        expect(result.error).toMatch(/--session/);
      }
    });

    it("returns ok:false when sessions exist but none match the regex", () => {
      const tmux = fakeTmuxWithSessions(["main", "omp-team-alpha"]);
      const result = resolveSession({ tmux });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/no running copilot session/);
      }
    });
  });

  describe("AC6: multiple matches", () => {
    it("returns ok:false listing candidate names and requiring --session", () => {
      const tmux = fakeTmuxWithSessions(["omp-111", "omp-222"]);
      const result = resolveSession({ tmux });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/omp-111/);
        expect(result.error).toMatch(/omp-222/);
        expect(result.error).toMatch(/--session/);
        expect(result.candidates).toEqual(["omp-111", "omp-222"]);
      }
    });
  });

  describe("AC7: omp-team-* alongside omp-<digits>", () => {
    it("excludes team sessions and resolves the copilot session", () => {
      const tmux = fakeTmuxWithSessions(["omp-team-foo", "omp-123", "main"]);
      const result = resolveSession({ tmux });
      expect(result).toEqual({ ok: true, session: "omp-123", source: "discovery" });
    });
  });

  describe("AC8: listSessions returns [] on non-zero tmux exit", () => {
    it("treats a non-zero list-sessions exit as no sessions", () => {
      const tmux = fakeTmuxWithSessions([], 1); // non-zero status simulates no server
      const result = resolveSession({ tmux });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/no running copilot session/);
      }
    });

    it("listSessions itself returns [] on non-zero exit", () => {
      const tmux = fakeTmuxWithSessions(["omp-123"], 1);
      // non-zero exit means tmux is not running — listSessions must return []
      expect(tmux.listSessions()).toEqual([]);
    });
  });

  describe("AC10: tmux.listSessions throwing", () => {
    it("returns a structured failure instead of throwing", () => {
      const tmux = {
        listSessions: () => {
          throw new Error("tmux unavailable");
        },
      } as unknown as TmuxApi;
      const result = resolveSession({ tmux });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/failed to list tmux sessions/i);
    });
  });
});

describe("comms CLI --session guard", () => {
  it("rejects --session with no value (flag is the last arg)", async () => {
    const r = await runCli(["comms", "status", "--session"]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/invalid or missing --session/i);
  });

  it("rejects a flag-like --session value", async () => {
    const r = await runCli(["comms", "status", "--session", "-x"]);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/invalid or missing --session/i);
  });
});
