import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

import { configSchema, type MaestroConfig } from '@maestro/config';
import { createEventBus, type MaestroEvent } from '@maestro/core';
import {
  runPipeline,
  type PipelineRunOptions,
  type PipelineRunResult,
} from '@maestro/pipeline';
import { createStateStore, type StateStore } from '@maestro/state';

export type TempFixture = {
  readonly repoRoot: string;
  cleanup(): Promise<void>;
};

export type RunFixture = TempFixture & {
  readonly runId: string;
  readonly prompt: string;
  readonly branch: string;
  readonly store: StateStore;
  readonly bus: ReturnType<typeof createEventBus>;
  readonly events: MaestroEvent[];
  readonly config: MaestroConfig;
};

function runCommand(
  cmd: string,
  args: readonly string[],
  cwd: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if ((code ?? 0) === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr.trim()}`));
      }
    });
  });
}

export async function createTempFixture(
  prefix = 'maestro-testkit-',
): Promise<TempFixture> {
  const repoRoot = await mkdtemp(join(tmpdir(), prefix));
  return {
    repoRoot,
    async cleanup() {
      await rm(repoRoot, { recursive: true, force: true });
    },
  };
}

export async function createGitFixture(): Promise<TempFixture> {
  const fixture = await createTempFixture('maestro-git-fixture-');
  await runCommand('git', ['init', '-b', 'main'], fixture.repoRoot);
  await runCommand(
    'git',
    ['config', 'user.email', 'maestro@example.com'],
    fixture.repoRoot,
  );
  await runCommand(
    'git',
    ['config', 'user.name', 'Maestro Test'],
    fixture.repoRoot,
  );
  await runCommand(
    'git',
    ['config', 'commit.gpgsign', 'false'],
    fixture.repoRoot,
  );
  await runCommand('git', ['config', 'tag.gpgsign', 'false'], fixture.repoRoot);
  await runCommand(
    'git',
    ['config', 'gpg.format', 'openpgp'],
    fixture.repoRoot,
  );
  await writeFile(join(fixture.repoRoot, 'README.md'), '# fixture\n', 'utf8');
  await runCommand('git', ['add', 'README.md'], fixture.repoRoot);
  await runCommand(
    'git',
    ['commit', '-m', 'test: initial fixture'],
    fixture.repoRoot,
  );
  return fixture;
}

export async function createRunFixture(
  options: {
    readonly runId?: string;
    readonly prompt?: string;
    readonly branch?: string;
    readonly config?: MaestroConfig;
  } = {},
): Promise<RunFixture> {
  const fixture = await createGitFixture();
  await mkdir(join(fixture.repoRoot, '.maestro'), { recursive: true });
  await writeFile(
    join(fixture.repoRoot, '.maestro', 'ARCHITECTURE.md'),
    '# Architecture\n\nFixture architecture.\n',
    'utf8',
  );

  const bus = createEventBus();
  const events: MaestroEvent[] = [];
  bus.on((event) => events.push(event));

  return {
    ...fixture,
    runId: options.runId ?? 'run-fixture',
    prompt: options.prompt ?? 'ship fixture',
    branch: options.branch ?? 'maestro/fixture',
    store: createStateStore({ repoRoot: fixture.repoRoot }),
    bus,
    events,
    config: options.config ?? configSchema.parse({}),
  };
}

export async function runPipelineFixture(
  overrides: Omit<
    Partial<PipelineRunOptions>,
    | 'runId'
    | 'prompt'
    | 'branch'
    | 'worktreePath'
    | 'repoRoot'
    | 'store'
    | 'bus'
    | 'config'
  > & {
    readonly fixture?: RunFixture;
  },
): Promise<PipelineRunResult> {
  const fixture = overrides.fixture ?? (await createRunFixture());
  return runPipeline({
    runId: fixture.runId,
    prompt: fixture.prompt,
    branch: fixture.branch,
    worktreePath: fixture.repoRoot,
    repoRoot: fixture.repoRoot,
    store: fixture.store,
    bus: fixture.bus,
    config: fixture.config,
    ...overrides,
  });
}
