import { randomUUID } from 'node:crypto';

import { executeBackgroundGardener } from '@maestro/agents';
import { ConfigValidationError, type MaestroConfig } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import { createStateStore, type StateStore } from '@maestro/state';
import { Command } from 'commander';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  /* v8 ignore next */
  stdout: (line) => process.stdout.write(`${line}\n`),
  /* v8 ignore next */
  stderr: (line) => process.stderr.write(`${line}\n`),
};

export type BackgroundCommandOptions = {
  readonly io?: Io;
  readonly cwd?: () => string;
  readonly store?: StateStore;
  readonly runBackground?: typeof executeBackgroundGardener;
  readonly randomUuid?: () => string;
};

function parseRunType(raw: string): 'doc' | 'code' | 'all' | null {
  if (raw === 'doc' || raw === 'code' || raw === 'all') return raw;
  return null;
}

async function loadConfigOrExit(
  io: Io,
  repoRoot: string,
): Promise<MaestroConfig | null> {
  try {
    const loaded = await loadConfigWithAutoResolvedModels({ cwd: repoRoot });
    return loaded.resolved;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      io.stderr('Configuration is invalid:');
      for (const issue of error.issues) {
        const path = issue.path.join('.') || '(root)';
        io.stderr(`  - ${path}: ${issue.message}`);
      }
      return null;
    }
    io.stderr((error as Error).message);
    return null;
  }
}

export function createBackgroundCommand(
  options: BackgroundCommandOptions = {},
): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => process.cwd());
  const runBackground = options.runBackground ?? executeBackgroundGardener;
  const randomUuid = options.randomUuid ?? (() => randomUUID());

  const resolveStore = (): StateStore =>
    options.store ?? createStateStore({ repoRoot: cwd() });

  const cmd = new Command('background').description(
    'Background agents (Doc Gardener / GC)',
  );

  cmd
    .command('run')
    .description(
      'Run documentation and light code-hygiene checks; write a report under .maestro/docs/background-reports/',
    )
    .option(
      '--type <runType>',
      "Scope: 'doc', 'code', or 'all' (default: all)",
      'all',
    )
    .option('--skip-llm', 'Heuristics and report only (no model)')
    .option('--skip-pr', 'Do not create branches or open PRs')
    .action(
      async (opts: { type: string; skipLlm?: boolean; skipPr?: boolean }) => {
        const repoRoot = cwd();
        const runType = parseRunType(opts.type);
        if (runType === null) {
          io.stderr(`Invalid --type "${opts.type}". Use doc, code, or all.`);
          process.exitCode = 1;
          return;
        }

        const config = await loadConfigOrExit(io, repoRoot);
        if (config === null) {
          process.exitCode = 1;
          return;
        }

        const store = resolveStore();
        await store.reconcileStaleRunningRuns();
        const latest = await store.latest();
        if (latest?.status === 'running') {
          io.stderr(
            `A Maestro pipeline run is active (${latest.runId}, status: running). Stop or wait before running background tasks.`,
          );
          process.exitCode = 2;
          return;
        }

        const bus = createEventBus();
        const runId = randomUuid();

        const result = await runBackground({
          repoRoot,
          runType,
          config,
          bus,
          runId,
          skipLlm: opts.skipLlm === true,
          skipPr: opts.skipPr === true,
        });

        io.stdout(
          `Background run finished: issuesFound=${result.issuesFound.toString()} report=${result.reportPath}`,
        );
        process.exitCode = result.issuesFound > 0 ? 1 : 0;
      },
    );

  return cmd;
}
