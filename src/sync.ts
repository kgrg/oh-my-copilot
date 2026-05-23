import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageRootFromImportMeta } from './project.js';

export interface ProjectionFile {
  path: string;
  content: string;
}

function projectSkillNames(packageRoot: string): string[] {
  const skillsRoot = join(packageRoot, '.github', 'skills');
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(skillsRoot, name, 'SKILL.md')))
    .sort();
}

export function projectCopilotCommands(): ProjectionFile[] {
  const packageRoot = packageRootFromImportMeta(import.meta.url);
  return projectSkillNames(packageRoot).map((name) => {
    const path = `.github/skills/${name}/SKILL.md`;
    return {
      path,
      content: readFileSync(join(packageRoot, path), 'utf8'),
    };
  });
}

export function formatDryRun(files = projectCopilotCommands()): string {
  return ['PASS: Copilot skills dry-run', ...files.map((file) => `- ${file.path} (${file.content.length} bytes)`)].join('\n');
}
