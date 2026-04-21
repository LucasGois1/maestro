import { createKBManager } from '@maestro/kb';
import { Command } from 'commander';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

type InitCommandOptions = {
  readonly io?: Io;
  readonly cwd?: () => string;
};

export function createInitCommand(options: InitCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => process.cwd());

  return new Command('init')
    .description('Create the .maestro/ knowledge base scaffold in the current repository')
    .action(async () => {
      const repoRoot = cwd();
      const kb = createKBManager({ repoRoot });
      await kb.init();
      await kb.appendLog({
        event: 'project.initialized',
        detail: 'Knowledge base scaffold created',
        now: new Date(),
      });
      io.stdout('Initialized Maestro knowledge base in .maestro/');
    });
}
