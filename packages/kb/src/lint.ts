import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { maestroRoot } from '@maestro/state';

import { createKBManager } from './manager.js';

export type KBLintIssue = {
  readonly rule:
    | 'missing-file'
    | 'broken-link'
    | 'duplicate-section'
    | 'missing-section'
    | 'agents-line-budget';
  readonly file: string;
  readonly message: string;
};

export type KBLintReport = {
  readonly ok: boolean;
  readonly issues: readonly KBLintIssue[];
  readonly fixedFiles: readonly string[];
};

export type LintKnowledgeBaseOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
  readonly fix?: boolean;
};

const REQUIRED_ARCHITECTURE_SECTIONS = [
  "Bird's Eye View",
  'Code Map',
  'Cross-Cutting Concerns',
  'Module Boundaries',
  'Data Flow',
] as const;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      return false;
    }
    throw error;
  }
}

function findHeadings(content: string): string[] {
  return content
    .split('\n')
    .map((line) => /^##\s+(.+)$/u.exec(line)?.[1]?.trim())
    .filter((heading): heading is string => heading !== undefined);
}

function collectDuplicateHeadings(file: string, headings: string[]): KBLintIssue[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const heading of headings) {
    if (seen.has(heading)) {
      duplicates.add(heading);
    }
    seen.add(heading);
  }

  return [...duplicates].map((heading) => ({
    rule: 'duplicate-section' as const,
    file,
    message: `Duplicate section "${heading}".`,
  }));
}

async function collectBrokenLinks(
  filePath: string,
  root: string,
  content: string,
): Promise<KBLintIssue[]> {
  const issues: KBLintIssue[] = [];
  const links = content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu);

  for (const match of links) {
    const target = match[1]?.trim();
    if (!target || /^(?:[a-z]+:|#)/iu.test(target)) {
      continue;
    }

    const fileTarget = target.split('#')[0];
    if (!fileTarget) {
      continue;
    }

    const resolved = resolve(dirname(filePath), fileTarget);
    if (await fileExists(resolved)) {
      continue;
    }

    issues.push({
      rule: 'broken-link',
      file: relativePath(root, filePath),
      message: `Broken link target "${target}".`,
    });
  }

  return issues;
}

function relativePath(root: string, filePath: string): string {
  return filePath.slice(root.length + 1).replace(/\\/gu, '/');
}

function appendMissingSections(content: string): { content: string; changed: boolean } {
  const headings = new Set(findHeadings(content));
  const missing = REQUIRED_ARCHITECTURE_SECTIONS.filter(
    (heading) => !headings.has(heading),
  );

  if (missing.length === 0) {
    return { content, changed: false };
  }

  const appended = [
    content.trimEnd(),
    '',
    ...missing.flatMap((heading) => [`## ${heading}`, 'TODO.']),
    '',
  ].join('\n');

  return {
    content: appended,
    changed: true,
  };
}

async function runLint(
  options: LintKnowledgeBaseOptions,
): Promise<{ issues: KBLintIssue[]; fixedFiles: string[] }> {
  const root = maestroRoot(options.repoRoot, options.maestroDir);
  const kb = createKBManager(options);
  const fixedFiles: string[] = [];
  const issues: KBLintIssue[] = [];

  const agentsPath = join(root, 'AGENTS.md');
  const architecturePath = join(root, 'ARCHITECTURE.md');

  const agentsExists = await fileExists(agentsPath);
  const architectureExists = await fileExists(architecturePath);

  if (!agentsExists) {
    issues.push({
      rule: 'missing-file',
      file: '.maestro/AGENTS.md',
      message: 'AGENTS.md is missing.',
    });
  }
  if (!architectureExists) {
    issues.push({
      rule: 'missing-file',
      file: '.maestro/ARCHITECTURE.md',
      message: 'ARCHITECTURE.md is missing.',
    });
  }

  if (!agentsExists || !architectureExists) {
    return { issues, fixedFiles };
  }

  const [agentsMd, initialArchitectureMd] = await Promise.all([
    readFile(agentsPath, 'utf8'),
    readFile(architecturePath, 'utf8'),
  ]);
  let architectureMd = initialArchitectureMd;

  if (options.fix) {
    const fixedArchitecture = appendMissingSections(architectureMd);
    if (fixedArchitecture.changed) {
      architectureMd = fixedArchitecture.content;
      await kb.write('ARCHITECTURE.md', architectureMd);
      fixedFiles.push('.maestro/ARCHITECTURE.md');
    }
  }

  const agentsLines = agentsMd.split('\n').filter(Boolean).length;
  if (agentsLines > 150) {
    issues.push({
      rule: 'agents-line-budget',
      file: '.maestro/AGENTS.md',
      message: `AGENTS.md exceeds the 150 line budget (${agentsLines} lines).`,
    });
  }

  const architectureHeadings = findHeadings(architectureMd);
  for (const heading of REQUIRED_ARCHITECTURE_SECTIONS) {
    if (architectureHeadings.includes(heading)) {
      continue;
    }
    issues.push({
      rule: 'missing-section',
      file: '.maestro/ARCHITECTURE.md',
      message: `Missing required section "${heading}".`,
    });
  }

  issues.push(
    ...collectDuplicateHeadings('.maestro/AGENTS.md', findHeadings(agentsMd)),
  );
  issues.push(
    ...collectDuplicateHeadings(
      '.maestro/ARCHITECTURE.md',
      architectureHeadings,
    ),
  );
  issues.push(...(await collectBrokenLinks(agentsPath, root, agentsMd)));
  issues.push(...(await collectBrokenLinks(architecturePath, root, architectureMd)));

  return { issues, fixedFiles };
}

export async function lintKnowledgeBase(
  options: LintKnowledgeBaseOptions,
): Promise<KBLintReport> {
  const firstPass = await runLint(options);
  if (!options.fix || firstPass.fixedFiles.length === 0) {
    return {
      ok: firstPass.issues.length === 0,
      issues: firstPass.issues,
      fixedFiles: firstPass.fixedFiles,
    };
  }

  const finalPass = await runLint({ ...options, fix: false });
  return {
    ok: finalPass.issues.length === 0,
    issues: finalPass.issues,
    fixedFiles: firstPass.fixedFiles,
  };
}
