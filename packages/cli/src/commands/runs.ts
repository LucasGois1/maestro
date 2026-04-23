import {
  createStateStore,
  type RunState,
  type StateStore,
} from '@maestro/state';
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

type RunsCommandOptions = {
  readonly io?: Io;
  readonly store?: StateStore;
  readonly cwd?: () => string;
  readonly confirm?: (prompt: string) => Promise<boolean>;
  /** Override terminal width for list table (tests / non-TTY). */
  readonly listColumns?: number;
};

const LIST_GAP = 2;
const LIST_COL_RUN_ID = 36;
const LIST_COL_STATUS = 10;
const LIST_COL_PHASE = 14;
const LIST_COL_UPDATED = 22;

function listTerminalColumns(explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit >= 48) {
    return explicit;
  }
  const c = process.stdout.columns;
  return typeof c === 'number' && Number.isFinite(c) && c >= 48 ? c : 100;
}

function clipCell(value: string, width: number): string {
  if (width <= 0) {
    return '';
  }
  const t = value;
  if (t.length <= width) {
    return t.padEnd(width, ' ');
  }
  if (width <= 1) {
    return '…';
  }
  return `${t.slice(0, width - 1)}…`;
}

function joinListColumns(parts: readonly string[]): string {
  return parts.join(' '.repeat(LIST_GAP));
}

function listTableReservedWidth(): number {
  return (
    LIST_COL_RUN_ID +
    LIST_COL_STATUS +
    LIST_COL_PHASE +
    LIST_COL_UPDATED +
    LIST_GAP * 4
  );
}

function listPromptColumnWidth(terminalColumns: number): number {
  const reserved = listTableReservedWidth();
  return Math.max(8, terminalColumns - reserved);
}

function formatListHeader(terminalColumns: number): string {
  const pw = listPromptColumnWidth(terminalColumns);
  return joinListColumns([
    clipCell('runId', LIST_COL_RUN_ID),
    clipCell('status', LIST_COL_STATUS),
    clipCell('phase', LIST_COL_PHASE),
    clipCell('updatedAt', LIST_COL_UPDATED),
    clipCell('prompt', pw),
  ]);
}

function formatListRow(state: RunState, terminalColumns: number): string {
  const pw = listPromptColumnWidth(terminalColumns);
  return joinListColumns([
    clipCell(state.runId, LIST_COL_RUN_ID),
    clipCell(state.status, LIST_COL_STATUS),
    clipCell(state.phase, LIST_COL_PHASE),
    clipCell(state.lastUpdatedAt, LIST_COL_UPDATED),
    clipCell(state.metadata.prompt, pw),
  ]);
}

function formatDetail(state: RunState): string {
  const parts = [
    `runId:        ${state.runId}`,
    `status:       ${state.status}`,
    `phase:        ${state.phase}`,
    `branch:       ${state.branch}`,
    `worktree:     ${state.worktreePath}`,
    `startedAt:    ${state.startedAt}`,
    `updatedAt:    ${state.lastUpdatedAt}`,
  ];
  if (state.pausedAt) parts.push(`pausedAt:     ${state.pausedAt}`);
  if (state.completedAt) parts.push(`completedAt:  ${state.completedAt}`);
  if (state.currentSprintIdx !== undefined) {
    parts.push(`sprintIdx:    ${state.currentSprintIdx}`);
  }
  if (state.retriesRemaining !== undefined) {
    parts.push(`retriesLeft:  ${state.retriesRemaining}`);
  }
  if (state.escalation) {
    const e = state.escalation;
    parts.push(
      `escalation:   sprint ${e.sprintIdx} — ${e.reason}`,
      `              source: ${e.source} · phaseAt: ${e.phaseAtEscalation} · resume: ${e.resumeTarget}`,
    );
    if (e.artifactHints?.length) {
      parts.push(`              hints: ${e.artifactHints.join(', ')}`);
    }
  }
  parts.push('metadata:');
  parts.push(`  prompt:    ${state.metadata.prompt}`);
  parts.push(`  userAgent: ${state.metadata.userAgent}`);
  return parts.join('\n');
}

export function createRunsCommand(options: RunsCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const listColumns = () => listTerminalColumns(options.listColumns);
  const cwd = options.cwd ?? (() => process.cwd());
  const confirm =
    options.confirm ??
    ((prompt: string) => {
      io.stderr(`${prompt} (non-interactive mode, pass --force)`);
      return Promise.resolve(false);
    });

  const resolveStore = (): StateStore =>
    options.store ?? createStateStore({ repoRoot: cwd() });

  const cmd = new Command('runs').description(
    'Inspect and manage Maestro run history',
  );

  cmd
    .command('list')
    .alias('ls')
    .description('List runs recorded in .maestro/runs/')
    .action(async () => {
      const store = resolveStore();
      const runs = await store.list();
      if (runs.length === 0) {
        io.stdout('No runs recorded.');
        return;
      }
      const cols = listColumns();
      io.stdout(formatListHeader(cols));
      for (const run of runs) {
        io.stdout(formatListRow(run, cols));
      }
    });

  cmd
    .command('show <runId>')
    .description('Show a single run in detail')
    .action(async (runId: string) => {
      const store = resolveStore();
      const state = await store.load(runId);
      if (!state) {
        io.stderr(`Run not found: ${runId}`);
        process.exitCode = 1;
        return;
      }
      io.stdout(formatDetail(state));
    });

  cmd
    .command('clean')
    .description('Delete completed runs (requires --force)')
    .option('--force', 'Skip confirmation prompt')
    .action(async (flags: { force?: boolean }) => {
      const store = resolveStore();
      const runs = await store.list();
      const targets = runs.filter((r) => r.status === 'completed');
      if (targets.length === 0) {
        io.stdout('No completed runs to clean.');
        return;
      }
      if (!flags.force) {
        const ok = await confirm(
          `About to delete ${targets.length} completed run(s). Continue?`,
        );
        if (!ok) return;
      }
      for (const run of targets) {
        await store.delete(run.runId);
        io.stdout(`Deleted ${run.runId}`);
      }
    });

  return cmd;
}
