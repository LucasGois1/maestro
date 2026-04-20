import { createKBManager, lintKnowledgeBase } from '@maestro/kb';
import { Command } from 'commander';

type Io = {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

const defaultIo: Io = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

type KbCommandOptions = {
  readonly io?: Io;
  readonly cwd?: () => string;
};

export function createKBCommand(options: KbCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => process.cwd());

  const kb = new Command('kb').description('Manage the Maestro knowledge base');

  kb.command('lint')
    .description('Validate AGENTS.md, ARCHITECTURE.md, and KB links')
    .option('--fix', 'Apply safe automatic fixes when possible')
    .action(async (flags: { fix?: boolean }) => {
      const repoRoot = cwd();

      if (flags.fix) {
        await createKBManager({ repoRoot }).init();
      }

      const report = await lintKnowledgeBase({
        repoRoot,
        ...(flags.fix ? { fix: true } : {}),
      });

      if (report.fixedFiles.length > 0) {
        io.stdout(`Fixed ${report.fixedFiles.length} file(s):`);
        for (const file of report.fixedFiles) {
          io.stdout(`- ${file}`);
        }
      }

      if (report.ok) {
        io.stdout('KB is valid.');
        return;
      }

      io.stderr('KB lint found issues:');
      for (const issue of report.issues) {
        io.stderr(`- ${issue.file}: ${issue.message}`);
      }
      process.exitCode = 1;
    });

  return kb;
}
