import { spawn } from 'node:child_process';

import { runGit, type GitRunner } from './runner.js';

export type Platform = 'github' | 'gitlab' | 'unknown';

export type RemoteInfo = {
  readonly name: string;
  readonly url: string;
  readonly platform: Platform;
};

function detectPlatformFromUrl(url: string): Platform {
  if (/github\.com[:/]/u.test(url)) return 'github';
  if (/gitlab\.[^:/]+[:/]/u.test(url)) return 'gitlab';
  return 'unknown';
}

export type DetectRemoteOptions = {
  readonly cwd: string;
  readonly remote?: string;
  readonly runner?: GitRunner;
};

export async function detectRemote(
  options: DetectRemoteOptions,
): Promise<RemoteInfo | null> {
  const runner = options.runner ?? runGit;
  const remoteName = options.remote ?? 'origin';
  const result = await runner(['remote', 'get-url', remoteName], {
    cwd: options.cwd,
    allowNonZero: true,
  });
  if (result.code !== 0) return null;
  const url = result.stdout.trim();
  if (url.length === 0) return null;
  return {
    name: remoteName,
    url,
    platform: detectPlatformFromUrl(url),
  };
}

export type PrDescriptor = {
  readonly title: string;
  readonly summary: string;
  readonly sprints: ReadonlyArray<{
    readonly id: string;
    readonly description: string;
    readonly acceptance: readonly string[];
  }>;
  readonly sensors?: readonly string[];
  readonly runId?: string;
  readonly labels?: readonly string[];
};

export function renderPrBody(pr: PrDescriptor): string {
  const lines: string[] = [];
  lines.push('## Summary');
  lines.push('');
  lines.push(pr.summary.trim());
  lines.push('');
  if (pr.sprints.length > 0) {
    lines.push('## Sprints');
    lines.push('');
    for (const sprint of pr.sprints) {
      lines.push(`### ${sprint.id} — ${sprint.description}`);
      if (sprint.acceptance.length > 0) {
        for (const item of sprint.acceptance) lines.push(`- [x] ${item}`);
      }
      lines.push('');
    }
  }
  if (pr.sensors && pr.sensors.length > 0) {
    lines.push('## Sensors');
    lines.push('');
    for (const sensor of pr.sensors) lines.push(`- ${sensor} ✅`);
    lines.push('');
  }
  if (pr.runId) {
    lines.push(`<sub>Maestro run: \`${pr.runId}\`</sub>`);
  }
  return lines.join('\n').trimEnd().concat('\n');
}

export type BuildPrCommandOptions = {
  readonly platform: Platform;
  readonly pr: PrDescriptor;
  readonly baseBranch?: string;
  readonly head?: string;
  /** Rascunho (GitHub: `--draft`; GitLab: `--draft` quando suportado). */
  readonly draft?: boolean;
};

export type PlatformCommand = {
  readonly program: 'gh' | 'glab';
  readonly args: readonly string[];
};

export class UnsupportedPlatformError extends Error {
  constructor(platform: Platform) {
    super(`PR creation not supported for platform "${platform}"`);
    this.name = 'UnsupportedPlatformError';
  }
}

export function buildPrCommand(
  options: BuildPrCommandOptions,
): PlatformCommand {
  const labels = options.pr.labels ?? ['maestro', 'ai-generated'];
  const body = renderPrBody(options.pr);

  if (options.platform === 'github') {
    const args = ['pr', 'create', '--title', options.pr.title, '--body', body];
    if (options.baseBranch) {
      args.push('--base', options.baseBranch);
    }
    if (options.head) {
      args.push('--head', options.head);
    }
    if (options.draft === true) {
      args.push('--draft');
    }
    for (const label of labels) args.push('--label', label);
    return { program: 'gh', args };
  }

  if (options.platform === 'gitlab') {
    const args = [
      'mr',
      'create',
      '--title',
      options.pr.title,
      '--description',
      body,
    ];
    if (options.baseBranch) {
      args.push('--target-branch', options.baseBranch);
    }
    if (options.head) {
      args.push('--source-branch', options.head);
    }
    if (options.draft === true) {
      args.push('--draft');
    }
    if (labels.length > 0) {
      args.push('--label', labels.join(','));
    }
    return { program: 'glab', args };
  }

  throw new UnsupportedPlatformError(options.platform);
}

export type ExecPrOptions = {
  readonly command: PlatformCommand;
  readonly cwd: string;
  readonly spawnImpl?: typeof spawn;
};

/** Extrai URL / número de PR ou MR a partir da saída típica de `gh` / `glab`. */
export function parsePrUrlFromCliOutput(stdout: string): {
  readonly prUrl?: string;
  readonly prNumber?: number;
} {
  const text = stdout.trim();
  const gh = /(https:\/\/github\.com\/[^\s]+\/pull\/(\d+))/u.exec(text);
  if (gh?.[1] !== undefined && gh[2] !== undefined) {
    return { prUrl: gh[1], prNumber: Number(gh[2]) };
  }
  const gl = /(https:\/\/[^\s]+\/-\/merge_requests\/(\d+))/u.exec(text);
  if (gl?.[1] !== undefined && gl[2] !== undefined) {
    return { prUrl: gl[1], prNumber: Number(gl[2]) };
  }
  const loose = /(https:\/\/[^\s]+)/u.exec(text);
  if (loose?.[1] !== undefined) {
    return { prUrl: loose[1] };
  }
  return {};
}

export function executePrCommand(
  options: ExecPrOptions,
): Promise<{ stdout: string; code: number }> {
  const impl = options.spawnImpl ?? spawn;
  return new Promise((resolve, reject) => {
    const child = impl(options.command.program, [...options.command.args], {
      cwd: options.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ stdout, code: code ?? 0 });
    });
  });
}
