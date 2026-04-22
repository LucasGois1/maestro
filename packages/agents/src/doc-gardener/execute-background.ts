import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import type { BackgroundConfig, MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import { maestroRoot } from '@maestro/state';

import { docGardenerAgent } from '../built-in.js';
import { runAgent } from '../runner.js';
import { isWorkingTreeClean } from './background-git.js';
import { detectCodeDriftHeuristic } from './detect-code-drift.js';
import {
  detectKnipIssues,
  detectPnpmOutdated,
  type PackageHealthFinding,
} from './detect-package-health.js';
import { detectStaleDocumentation } from './detect-stale-docs.js';
import type {
  GardenerOutput,
  GardenerPrOpened,
} from './gardener-output.schema.js';
import {
  mergeOpenPrDeps,
  openPrForCategory,
  type OpenPrDeps,
} from './open-pr-category.js';

const TOOL_TIMEOUT_MS = 120_000;

export type ExecuteBackgroundOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
  readonly runType: 'doc' | 'code' | 'all';
  readonly config: MaestroConfig;
  readonly bus: EventBus;
  readonly runId: string;
  /** Não chama o modelo (só heurísticas + relatório). */
  readonly skipLlm?: boolean;
  /** Não cria branches/PRs (testes/CI). */
  readonly skipPr?: boolean;
  /** Injeta deps de teste (git/gh). */
  readonly openPrDeps?: Partial<OpenPrDeps>;
};

export type ExecuteBackgroundResult = {
  readonly issuesFound: number;
  readonly reportPath: string;
  readonly output: GardenerOutput;
};

async function readUtf8(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function renderReportMarkdown(opts: {
  readonly runType: 'doc' | 'code' | 'all';
  readonly docFindings: readonly { path: string; message: string }[];
  readonly duplicateFindings: readonly { path: string; message: string }[];
  readonly knipFindings: readonly PackageHealthFinding[];
  readonly outdatedFindings: readonly PackageHealthFinding[];
  readonly prSkippedDirty?: boolean;
  readonly agentSummary?: string;
}): string {
  const lines: string[] = [
    `# Maestro background report`,
    '',
    `- runType: ${opts.runType}`,
    '',
    '## Doc hygiene',
    '',
  ];
  if (opts.docFindings.length === 0) lines.push('(none)');
  else
    for (const f of opts.docFindings) {
      lines.push(`- **${f.path}**: ${f.message}`);
    }

  lines.push('', '## Duplicate snippets (heuristic)', '');
  if (opts.duplicateFindings.length === 0) lines.push('(none)');
  else
    for (const f of opts.duplicateFindings) {
      lines.push(`- **${f.path}**: ${f.message}`);
    }

  lines.push('', '## Knip', '');
  if (opts.knipFindings.length === 0) lines.push('(none)');
  else
    for (const f of opts.knipFindings) {
      lines.push(`- **${f.path}**: ${f.message}`);
    }

  lines.push('', '## Outdated dependencies (pnpm outdated)', '');
  if (opts.outdatedFindings.length === 0) lines.push('(none)');
  else
    for (const f of opts.outdatedFindings) {
      lines.push(`- **${f.path}**: ${f.message}`);
    }

  if (opts.prSkippedDirty === true) {
    lines.push(
      '',
      '## PRs',
      '',
      'Skipped: working tree is not clean (commit or stash before opening PRs).',
    );
  }

  if (opts.agentSummary !== undefined && opts.agentSummary.length > 0) {
    lines.push('', '## Agent notes', '', opts.agentSummary);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Orquestra heurísticas, agente opcional, relatório e um PR por categoria (doc vs código).
 *
 * `issuesFound` = max(heurísticas totais, issues reportadas pelo LLM), para não duplicar contagens.
 */
export async function executeBackgroundGardener(
  opts: ExecuteBackgroundOptions,
): Promise<ExecuteBackgroundResult> {
  const root = maestroRoot(opts.repoRoot, opts.maestroDir);
  const reportsDir = join(root, 'docs', 'background-reports');
  await mkdir(reportsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const reportPath = join(reportsDir, `${stamp}.md`);
  const reportRel = relative(opts.repoRoot, reportPath).replace(/\\/gu, '/');

  const backgroundFallback: BackgroundConfig = {
    knip: true,
    outdated: true,
    maxFindingsPerSource: 80,
  };
  const bg = opts.config.background ?? backgroundFallback;
  const maxF = bg.maxFindingsPerSource;

  let docFindings: readonly { path: string; message: string }[] = [];
  let duplicateFindings: readonly { path: string; message: string }[] = [];
  let knipFindings: readonly PackageHealthFinding[] = [];
  let outdatedFindings: readonly PackageHealthFinding[] = [];

  if (opts.runType !== 'code') {
    docFindings = await detectStaleDocumentation(
      opts.repoRoot,
      opts.maestroDir,
    );
  }
  if (opts.runType !== 'doc') {
    duplicateFindings = await detectCodeDriftHeuristic(opts.repoRoot);
    if (bg.knip) {
      knipFindings = await detectKnipIssues(opts.repoRoot, {
        timeoutMs: TOOL_TIMEOUT_MS,
        maxFindings: maxF,
      });
    }
    if (bg.outdated) {
      outdatedFindings = await detectPnpmOutdated(opts.repoRoot, {
        timeoutMs: TOOL_TIMEOUT_MS,
        maxFindings: maxF,
      });
    }
  }

  const agentsMdPreview = await readUtf8(join(root, 'AGENTS.md'));
  const goldenPreview = await readUtf8(
    join(root, 'docs', 'golden-principles', 'index.md'),
  );

  let agentText = '';
  let parsedAgent: GardenerOutput | null = null;
  if (!opts.skipLlm) {
    const run = await runAgent({
      definition: docGardenerAgent,
      input: {
        repoRoot: opts.repoRoot,
        runType: opts.runType,
        reportPath: reportRel,
        agentsMdPreview: agentsMdPreview.slice(0, 24_000),
        goldenPrinciplesPreview: goldenPreview.slice(0, 24_000),
        scanRootsHint: '.maestro/, docs/',
      },
      context: {
        agentId: 'doc-gardener',
        runId: opts.runId,
        workingDir: opts.repoRoot,
        metadata: {},
      },
      bus: opts.bus,
      config: opts.config,
    });
    agentText = run.text;
    parsedAgent = run.output as GardenerOutput;
  }

  const heuristicTotal =
    docFindings.length +
    duplicateFindings.length +
    knipFindings.length +
    outdatedFindings.length;
  const llmIssues = parsedAgent?.issuesFound ?? 0;
  const issuesFound = Math.max(heuristicTotal, llmIssues);

  const breakdown = {
    docHygiene: docFindings.length,
    codeDuplicate: duplicateFindings.length,
    knip: knipFindings.length,
    outdated: outdatedFindings.length,
    ...(opts.skipLlm ? {} : { llmReported: llmIssues }),
  };

  const prDeps = mergeOpenPrDeps(opts.openPrDeps);

  let prs: GardenerPrOpened[] = parsedAgent?.prsOpened ?? [];
  let prSkippedDirty = false;

  const codeRelatedCount =
    duplicateFindings.length + knipFindings.length + outdatedFindings.length;
  const wantDocPr = docFindings.length > 0;
  const wantCodePr = codeRelatedCount > 0;

  if (!opts.skipPr && (wantDocPr || wantCodePr)) {
    try {
      const clean = await isWorkingTreeClean(prDeps.runGit, opts.repoRoot);
      if (!clean) {
        prSkippedDirty = true;
      }
    } catch {
      prSkippedDirty = true;
    }
  }

  if (!opts.skipPr && !prSkippedDirty) {
    if (wantDocPr) {
      const pr = await openPrForCategory(
        opts.repoRoot,
        'doc-fix',
        'docs: Maestro background hygiene',
        renderReportMarkdown({
          runType: opts.runType,
          docFindings,
          duplicateFindings: [],
          knipFindings: [],
          outdatedFindings: [],
          agentSummary: agentText.slice(0, 2000),
        }),
        prDeps,
      );
      if (pr) prs = [...prs, pr];
    }
    if (wantCodePr) {
      const pr = await openPrForCategory(
        opts.repoRoot,
        'code-cleanup',
        'refactor: Maestro background code / package hygiene',
        renderReportMarkdown({
          runType: opts.runType,
          docFindings: [],
          duplicateFindings,
          knipFindings,
          outdatedFindings,
          agentSummary: agentText.slice(0, 2000),
        }),
        prDeps,
      );
      if (pr) prs = [...prs, pr];
    }
  }

  const reportBody = renderReportMarkdown({
    runType: opts.runType,
    docFindings,
    duplicateFindings,
    knipFindings,
    outdatedFindings,
    prSkippedDirty,
    ...(agentText.length > 0 ? { agentSummary: agentText.slice(0, 8000) } : {}),
  });
  await writeFile(reportPath, reportBody, 'utf8');

  const output: GardenerOutput = {
    runType: opts.runType,
    issuesFound,
    prsOpened: prs,
    reportPath: reportRel,
    breakdown,
  };

  return { issuesFound, reportPath: reportRel, output };
}
