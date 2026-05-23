import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter, resolveProjectPaths } from './project.js';

export interface SkillInstallOptions {
  cwd?: string;
  root?: string;
  source: string;
  scope?: 'project' | 'user';
  dryRun?: boolean;
}

export interface SkillInstallResult {
  ok: boolean;
  dryRun: boolean;
  skillName: string;
  sourceDir: string;
  targetDir: string;
  files: string[];
}

function findSkillDir(input: string, cwd: string): string {
  const direct = resolve(cwd, input);
  if (existsSync(join(direct, 'SKILL.md'))) return direct;
  if (existsSync(direct) && statSync(direct).isFile() && basename(direct) === 'SKILL.md') {
    return resolve(direct, '..');
  }
  throw new Error(`skill source must be a directory containing SKILL.md: ${input}`);
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path, base);
    return [path.slice(base.length + 1)];
  }).sort();
}

export function installSkill(options: SkillInstallOptions): SkillInstallResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const sourceDir = findSkillDir(options.source, cwd);
  const skillFile = join(sourceDir, 'SKILL.md');
  const frontmatter = parseFrontmatter(readFileSync(skillFile, 'utf8'));
  const skillName = frontmatter.name || basename(sourceDir);
  if (!frontmatter.name) throw new Error(`missing skill name in ${skillFile}`);
  if (!frontmatter.description) throw new Error(`missing skill description in ${skillFile}`);

  const scope = options.scope ?? 'project';
  const targetRoot = scope === 'user'
    ? join(homedir(), '.copilot', 'skills')
    : join(resolveProjectPaths({ cwd, packageRoot: options.root }).packageRoot, '.github', 'skills');
  const targetDir = join(targetRoot, skillName);
  const files = listFiles(sourceDir);

  if (!options.dryRun) {
    mkdirSync(targetRoot, { recursive: true });
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(sourceDir, targetDir, { recursive: true });
  }

  return {
    ok: true,
    dryRun: Boolean(options.dryRun),
    skillName,
    sourceDir,
    targetDir,
    files,
  };
}

export function formatSkillInstall(result: SkillInstallResult): string {
  const action = result.dryRun ? 'DRY-RUN' : 'PASS';
  return [
    `${action}: skill install /${result.skillName}`,
    `source=${result.sourceDir}`,
    `target=${result.targetDir}`,
    ...result.files.map((file) => `- ${file}`),
  ].join('\n');
}
