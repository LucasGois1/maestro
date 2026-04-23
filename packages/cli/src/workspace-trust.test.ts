import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isWorkspaceTrusted,
  recordWorkspaceTrust,
  trustedWorkspacesStorePath,
} from './workspace-trust.js';

describe('workspace trust', () => {
  let home: string;
  let repo: string;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    home = await mkdtemp(join(tmpdir(), 'maestro-trust-home-'));
    repo = await mkdtemp(join(tmpdir(), 'maestro-trust-repo-'));
    vi.stubEnv('HOME', home);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(home, { recursive: true, force: true }).catch(() => undefined);
    await rm(repo, { recursive: true, force: true }).catch(() => undefined);
  });

  it('records and reads trust for a resolved repo path', async () => {
    expect(await isWorkspaceTrusted(repo)).toBe(false);
    await recordWorkspaceTrust(repo);
    expect(await isWorkspaceTrusted(repo)).toBe(true);

    const raw = await readFile(trustedWorkspacesStorePath(), 'utf8');
    const data = JSON.parse(raw) as { paths: Record<string, unknown> };
    expect(Object.keys(data.paths).length).toBe(1);
  });
});
