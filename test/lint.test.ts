import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { lintSkills } from '../src/lint.js';
import { listSkillNames, resolveProjectPaths } from '../src/project.js';

describe('skill portability lint', () => {
  it('passes committed canonical skills without catalog errors', () => {
    const issues = lintSkills({ cwd: process.cwd() });
    expect(issues.filter((issue) => issue.level === 'error')).toEqual([]);
    expect(issues.filter((issue) => issue.level === 'warning')).toEqual([]);
  });

  it('keeps runtime-specific command examples out of Copilot skills', () => {
    const paths = resolveProjectPaths({ cwd: process.cwd() });
    const skillNames = listSkillNames(paths.packageRoot);
    const dollarCommandPattern = new RegExp(`\\$(?:${skillNames.join('|')})\\b`, 'i');
    const runtimePathPattern = /(?:\.claude(?:-plugin)?|\.agents|\.omx|\.github\/copilot)\//i;
    for (const name of skillNames) {
      const skillFile = path.join(paths.packageRoot, '.github', 'skills', name, 'SKILL.md');
      const body = readFileSync(skillFile, 'utf8');
      expect(body, `${name} uses slash skill syntax`).toContain(`/${name}`);
      expect(body, `${name} avoids dollar command syntax`).not.toMatch(dollarCommandPattern);
      expect(body, `${name} avoids runtime state coupling`).not.toMatch(/OMX_TEAM_STATE_ROOT|TMUX_PANE|tmux-only/i);
      expect(body, `${name} avoids runtime path coupling`).not.toMatch(runtimePathPattern);
    }
  });

  it('uses only Copilot project skills without compatibility skill roots', () => {
    const paths = resolveProjectPaths({ cwd: process.cwd() });
    expect(existsSync(path.join(paths.packageRoot, '.github', 'skills'))).toBe(true);
    expect(existsSync(path.join(paths.packageRoot, '.agents'))).toBe(false);
    expect(existsSync(path.join(paths.packageRoot, '.claude'))).toBe(false);
  });

});
