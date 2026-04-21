import { loadConfig } from '@maestro/config';
import {
  applyDiscoveryToKb,
  applyGreenfieldTemplate,
  isGreenfieldTemplateId,
  listGreenfieldTemplateIds,
  runComputationalDiscovery,
  runInferentialDiscovery,
  writeDiscoveryDraft,
} from '@maestro/discovery';
import { commitMaestroKbInit } from '@maestro/git';
import { createKBManager } from '@maestro/kb';
import { listInferenceReadyProviders } from '@maestro/provider';
import { Command } from 'commander';

import {
  formatDiscoveryProviderSummary,
  runInitDiscoveryTui,
} from '../init-discovery-tui.js';
import {
  resolveDiscoveryConfigNonInteractive,
  runDiscoveryProviderSetupInk,
} from '../init-provider-setup.js';

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

async function commitIfRequested(
  flags: { readonly commit?: boolean },
  repoRoot: string,
  io: Io,
): Promise<void> {
  if (!flags.commit) {
    return;
  }
  const { resolved: config } = await loadConfig({ cwd: repoRoot });
  const result = await commitMaestroKbInit({
    cwd: repoRoot,
    branchName: config.discovery.initBranch,
  });
  if (result.kind === 'skipped') {
    io.stderr('Not a git repository; skipping branch and commit.');
    return;
  }
  if (result.kind === 'error') {
    io.stderr(result.message);
    process.exitCode = 1;
    return;
  }
  io.stdout(
    `Git: branch ${result.branch}, commit ${result.commitSha.slice(0, 7)}`,
  );
}

export function createInitCommand(options: InitCommandOptions = {}): Command {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? (() => process.cwd());

  return new Command('init')
    .description(
      'Initialize the .maestro/ knowledge base (optionally run discovery or apply a greenfield template)',
    )
    .option(
      '--template <name>',
      `Greenfield template (${listGreenfieldTemplateIds().join(', ')})`,
    )
    .option(
      '--no-ai',
      'Skip inferential discovery (stack/structure scan only; no LLM)',
    )
    .option(
      '--apply',
      'Write inferential AGENTS.md / ARCHITECTURE.md into .maestro/ (default is draft under .discovery-draft/)',
    )
    .option(
      '--commit',
      'After KB files are written, switch to discovery.initBranch and commit .maestro/ (no-op if not a git repo)',
    )
    .action(
      async (flags: {
        template?: string;
        ai: boolean;
        apply?: boolean;
        commit?: boolean;
      }) => {
        const repoRoot = cwd();
        const kb = createKBManager({ repoRoot });
        await kb.init();

        if (flags.template !== undefined) {
          if (!isGreenfieldTemplateId(flags.template)) {
            io.stderr(
              `Unknown template "${flags.template}". Choose one of: ${listGreenfieldTemplateIds().join(', ')}`,
            );
            process.exitCode = 1;
            return;
          }
          await applyGreenfieldTemplate(repoRoot, flags.template);
          await kb.appendLog({
            event: 'project.initialized',
            detail: `Greenfield template applied: ${flags.template}`,
            now: new Date(),
          });
          io.stdout(
            `Initialized .maestro/ from template "${flags.template}".`,
          );
          await commitIfRequested(flags, repoRoot, io);
          return;
        }

        const { resolved: config } = await loadConfig({ cwd: repoRoot });

        if (flags.ai === false) {
          const comp = await runComputationalDiscovery(repoRoot);
          await kb.appendLog({
            event: 'project.initialized',
            detail: `Scaffold only; stack=${comp.stack.kind}`,
            now: new Date(),
          });
          io.stdout(
            `Initialized .maestro/ (computational stack: ${comp.stack.kind}).`,
          );
          await commitIfRequested(flags, repoRoot, io);
          return;
        }

        if (!config.discovery.enabled) {
          await kb.appendLog({
            event: 'project.initialized',
            detail: 'Knowledge base scaffold created (discovery disabled)',
            now: new Date(),
          });
          io.stdout('Initialized Maestro knowledge base in .maestro/');
          await commitIfRequested(flags, repoRoot, io);
          return;
        }

        const useDiscoveryTui =
          process.stdout.isTTY &&
          process.stdin.isTTY &&
          !flags.apply;

        if (useDiscoveryTui) {
          const setup = await runDiscoveryProviderSetupInk({
            config,
            env: process.env,
          });
          if (setup.kind === 'skip-ai') {
            const comp = await runComputationalDiscovery(repoRoot);
            await kb.appendLog({
              event: 'project.initialized',
              detail: `Scaffold only; stack=${comp.stack.kind} (inferential discovery skipped)`,
              now: new Date(),
            });
            io.stdout(
              `Initialized .maestro/ (computational stack: ${comp.stack.kind}).`,
            );
            await commitIfRequested(flags, repoRoot, io);
            return;
          }
          const outcome = await runInitDiscoveryTui({
            repoRoot,
            config: setup.config,
            providerSummary: formatDiscoveryProviderSummary(setup.config),
          });
          if (!outcome.ok) {
            io.stderr(`Discovery failed: ${outcome.message}`);
            await kb.appendLog({
              event: 'discovery.failed',
              detail: outcome.message,
              level: 'error',
              now: new Date(),
            });
            process.exitCode = 1;
            return;
          }
          if (outcome.choice === 'accept') {
            await applyDiscoveryToKb(repoRoot, outcome.docs);
            io.stdout(
              'Discovery complete. Updated .maestro/AGENTS.md and ARCHITECTURE.md.',
            );
          } else {
            await writeDiscoveryDraft(repoRoot, outcome.docs);
            io.stdout(
              'Discovery draft saved under .maestro/.discovery-draft/',
            );
          }
          await kb.appendLog({
            event: 'project.initialized',
            detail: 'Inferential discovery completed (TUI)',
            now: new Date(),
          });
          await commitIfRequested(flags, repoRoot, io);
          return;
        }

        try {
          const effectiveConfig = resolveDiscoveryConfigNonInteractive(config);
          if (effectiveConfig === null) {
            const ready = listInferenceReadyProviders(config);
            if (ready.length === 0) {
              io.stderr(
                'Discovery needs a model API key. Set MAESTRO_OPENAI_KEY or another MAESTRO_*_KEY, or providers.*.apiKey in .maestro/config.json. Use --no-ai for scan-only.',
              );
            } else {
              io.stderr(
                `Several providers are configured (${ready.join(', ')}). Set defaults.discovery.model in .maestro/config.json to one model ref (e.g. openai/gpt-4o-mini), or run maestro init in an interactive terminal to pick a provider.`,
              );
            }
            process.exitCode = 1;
            return;
          }
          const docs = await runInferentialDiscovery({
            repoRoot,
            config: effectiveConfig,
          });
          if (flags.apply) {
            await applyDiscoveryToKb(repoRoot, docs);
            io.stdout(
              'Discovery complete. Updated .maestro/AGENTS.md and ARCHITECTURE.md.',
            );
          } else {
            await writeDiscoveryDraft(repoRoot, docs);
            io.stdout(
              'Discovery complete. Review .maestro/.discovery-draft/ then move into place or run with --apply.',
            );
          }
          await kb.appendLog({
            event: 'project.initialized',
            detail: 'Inferential discovery completed',
            now: new Date(),
          });
          await commitIfRequested(flags, repoRoot, io);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          io.stderr(`Discovery failed: ${message}`);
          await kb.appendLog({
            event: 'discovery.failed',
            detail: message,
            level: 'error',
            now: new Date(),
          });
          process.exitCode = 1;
        }
      },
    );
}
