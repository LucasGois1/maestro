import {
  appendProjectLog,
  createStateStore,
  type StateStore,
} from '@maestro/state';
import { Command } from 'commander';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

export type AbortCommandOptions = {
  readonly io?: Io;
  readonly store?: StateStore;
  readonly cwd?: () => string;
  readonly now?: () => Date;
};

export function createAbortCommand(options: AbortCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => process.cwd());
  const resolveStore = (): StateStore =>
    options.store ?? createStateStore({ repoRoot: cwd() });

  const cmd = new Command('abort')
    .description('Cancel a run immediately (marks state as canceled)')
    .argument('[runId]', 'Run id; defaults to the most recent run')
    .action(async (runId: string | undefined) => {
      const store = resolveStore();
      const target = runId ? await store.load(runId) : await store.latest();
      if (!target) {
        io.stderr('No run to abort.');
        process.exitCode = 1;
        return;
      }
      const now = (options.now ?? (() => new Date()))();
      await store.update(target.runId, {
        status: 'canceled',
        phase: 'failed',
      });
      await appendProjectLog({
        repoRoot: cwd(),
        entry: {
          runId: target.runId,
          event: 'run.aborted',
          level: 'warn',
          detail: 'maestro abort',
          now,
        },
      });
      io.stdout(`Aborted ${target.runId}`);
    });

  return cmd;
}
