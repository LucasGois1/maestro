import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { WorkspaceTrustPrompt } from './workspace-trust-prompt.js';

const STORE_VERSION = 1 as const;
const TRUST_FILENAME = 'trusted-workspaces.json' as const;

export type TrustedWorkspacesFile = {
  readonly version: typeof STORE_VERSION;
  readonly paths: Record<string, { readonly trustedAt: string }>;
};

export function trustedWorkspacesStorePath(): string {
  return join(homedir(), '.maestro', TRUST_FILENAME);
}

async function readTrustFile(): Promise<TrustedWorkspacesFile> {
  try {
    const raw = await readFile(trustedWorkspacesStorePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<TrustedWorkspacesFile>;
    if (parsed.version !== STORE_VERSION || typeof parsed.paths !== 'object') {
      return { version: STORE_VERSION, paths: {} };
    }
    return { version: STORE_VERSION, paths: { ...parsed.paths } };
  } catch {
    return { version: STORE_VERSION, paths: {} };
  }
}

export async function isWorkspaceTrusted(repoRoot: string): Promise<boolean> {
  try {
    const resolved = await realpath(repoRoot);
    const file = await readTrustFile();
    return file.paths[resolved] !== undefined;
  } catch {
    return false;
  }
}

export async function recordWorkspaceTrust(repoRoot: string): Promise<void> {
  const resolved = await realpath(repoRoot);
  const dir = join(homedir(), '.maestro');
  await mkdir(dir, { recursive: true });
  const file = await readTrustFile();
  const next: TrustedWorkspacesFile = {
    version: STORE_VERSION,
    paths: {
      ...file.paths,
      [resolved]: { trustedAt: new Date().toISOString() },
    },
  };
  await writeFile(
    trustedWorkspacesStorePath(),
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8',
  );
}

function skipTrustChecks(): boolean {
  return (
    process.env.MAESTRO_SKIP_WORKSPACE_TRUST === '1' ||
    process.env.MAESTRO_SKIP_WORKSPACE_TRUST === 'true'
  );
}

/**
 * When stdin/stdout are TTYs and the path is not yet trusted, shows a short Ink
 * prompt. Non-interactive runs skip the prompt (same behaviour as before).
 *
 * @returns whether execution may continue in this folder
 */
export async function ensureWorkspaceTrustInteractive(
  repoRoot: string,
): Promise<boolean> {
  if (skipTrustChecks()) {
    return true;
  }
  if (await isWorkspaceTrusted(repoRoot)) {
    return true;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return true;
  }

  let resolved: string;
  try {
    resolved = await realpath(repoRoot);
  } catch {
    resolved = repoRoot;
  }

  return new Promise((resolve) => {
    let ink: Instance | undefined;
    const finish = (ok: boolean) => {
      ink?.unmount();
      ink = undefined;
      resolve(ok);
    };

    ink = render(
      createElement(WorkspaceTrustPrompt, {
        resolvedPath: resolved,
        onTrust: () => {
          void recordWorkspaceTrust(repoRoot)
            .then(() => finish(true))
            .catch((err: unknown) => {
              const message =
                err instanceof Error ? err.message : String(err);
              process.stderr.write(
                `Could not save workspace trust: ${message}\n`,
              );
              finish(false);
            });
        },
        onReject: () => finish(false),
      }),
      { exitOnCtrlC: false },
    );
  });
}
