import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCatalogBundle, validateCatalogBundle } from './catalog.js';
import { resolveProjectPaths } from './project.js';

export interface LintIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  file?: string;
}

const providerRuntimeTerms = ['tmux-only', 'Codex-only', 'Claude-only', 'OMX_TEAM_STATE_ROOT', 'TMUX_PANE', '.omx', '.agents', '.claude', '.github/copilot'];

function parseFrontmatter(markdown: string): Record<string, string> {
  if (!markdown.startsWith('---\n')) return {};
  const end = markdown.indexOf('\n---', 4);
  if (end === -1) return {};
  const fields: Record<string, string> = {};
  for (const line of markdown.slice(4, end).trim().split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) fields[match[1]] = match[2].replace(/^['\"]|['\"]$/g, '');
  }
  return fields;
}

function listSkillNames(skillsRoot: string): Set<string> {
  if (!existsSync(skillsRoot)) return new Set();
  return new Set(
    readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
}

export function lintSkills(rootOrOptions: string | { cwd?: string; packageRoot?: string } = {}): LintIssue[] {
  const paths = typeof rootOrOptions === 'string'
    ? resolveProjectPaths({ cwd: resolve(rootOrOptions) })
    : resolveProjectPaths(rootOrOptions);
  const issues: LintIssue[] = [];
  const bundle = loadCatalogBundle(paths.catalogDir);
  const catalogValidation = validateCatalogBundle(bundle);

  for (const issue of catalogValidation.issues) {
    issues.push({ level: 'error', code: `catalog.${issue.code}`, message: issue.message, file: issue.path });
  }

  const presentSkills = listSkillNames(paths.defaultSkillsRoot);
  const catalogSkills = new Map(
    bundle.skills.skills
      .filter((entry) => entry.sourcePath.startsWith('.github/skills/'))
      .map((skill) => [skill.sourcePath.split('/').at(-2) ?? skill.name, skill]),
  );

  for (const skill of catalogSkills.values()) {
    const skillDir = skill.sourcePath.split('/').at(-2) ?? skill.name;
    const file = resolve(paths.packageRoot, skill.sourcePath);
    if (!presentSkills.has(skillDir) || !existsSync(file)) {
      issues.push({ level: 'error', code: 'skill.missing', message: `missing skill file for ${skill.name}`, file });
      continue;
    }
  }

  for (const skillDir of presentSkills) {
    const file = resolve(paths.defaultSkillsRoot, skillDir, 'SKILL.md');
    if (!existsSync(file)) continue;

    const body = readFileSync(file, 'utf8');
    const frontmatter = parseFrontmatter(body);
    const catalogSkill = catalogSkills.get(skillDir);
    if (catalogSkill && frontmatter.name !== catalogSkill.name && !catalogSkill.aliases.includes(frontmatter.name ?? '')) {
      issues.push({ level: 'error', code: 'skill.name', message: `frontmatter name ${frontmatter.name ?? '<missing>'} does not match ${catalogSkill.name}`, file });
    } else if (!catalogSkill && frontmatter.name !== skillDir) {
      issues.push({ level: 'error', code: 'skill.name', message: `frontmatter name ${frontmatter.name ?? '<missing>'} does not match ${skillDir}`, file });
    }
    if (!frontmatter.description) {
      issues.push({ level: 'warning', code: 'skill.description', message: `missing description for ${skillDir}`, file });
    }
    for (const term of providerRuntimeTerms) {
      if (body.includes(term)) {
        issues.push({ level: 'warning', code: 'skill.portability', message: `provider-specific wording found: ${term}`, file });
      }
    }
    if (/\$[A-Za-z][A-Za-z0-9_-]*|\.github\/copilot|\.claude-plugin|\.agents|\.claude|\.omx/i.test(body)) {
      issues.push({ level: 'warning', code: 'skill.provider-syntax', message: 'canonical skill should use slash skills and avoid provider/runtime paths', file });
    }
  }

  const grillMe = resolve(paths.packageRoot, '.github/skills/grill-me/SKILL.md');
  if (!existsSync(grillMe)) {
    issues.push({ level: 'error', code: 'skill.missing', message: 'missing grill-me skill', file: grillMe });
  }

  return issues;
}

export function formatLintIssues(issues: LintIssue[]): string {
  if (issues.length === 0) return 'PASS: skill lint found no issues';
  return issues.map((issue) => `${issue.level.toUpperCase()} ${issue.code}: ${issue.message}${issue.file ? ` (${issue.file})` : ''}`).join('\n');
}
