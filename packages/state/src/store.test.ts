import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runsRoot } from './paths.js';
import {
  createStateStore,
  StateStoreError,
  type CreateRunOptions,
} from './store.js';

let repoRoot: string;

const baseOpts: CreateRunOptions = {
  runId: 'run-1',
  branch: 'maestro/demo',
  worktreePath: '/tmp/wt',
  prompt: 'ship auth',
  userAgent: 'maestro/0.1.0',
  providerDefaults: { planner: 'openai/gpt-5' },
  now: () => new Date('2026-04-20T00:00:00.000Z'),
};

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-store-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function store(now = () => new Date('2026-04-20T00:00:05.000Z')) {
  return createStateStore({ repoRoot, now });
}

describe('StateStore', () => {
  it('creates a run and writes both state and meta', async () => {
    const s = store();
    const state = await s.create(baseOpts);
    expect(state.runId).toBe('run-1');
    expect(state.status).toBe('running');
    expect(state.phase).toBe('idle');

    const loaded = await s.load('run-1');
    expect(loaded).toEqual(state);
    const meta = await s.loadMeta('run-1');
    expect(meta?.prompt).toBe('ship auth');
    expect(meta?.startedAt).toBe('2026-04-20T00:00:00.000Z');
  });

  it('update() merges patch and refreshes lastUpdatedAt', async () => {
    const s = store();
    await s.create(baseOpts);
    const next = await s.update('run-1', { phase: 'planning' });
    expect(next.phase).toBe('planning');
    expect(next.lastUpdatedAt).toBe('2026-04-20T00:00:05.000Z');
  });

  it('update() throws for missing runs', async () => {
    const s = store();
    await expect(
      s.update('missing', { phase: 'planning' }),
    ).rejects.toBeInstanceOf(StateStoreError);
  });

  it('list() ignores files under runs/ (e.g. .gitkeep)', async () => {
    const s = store();
    await s.create(baseOpts);
    await writeFile(join(runsRoot(repoRoot), '.gitkeep'), '\n', 'utf8');
    const all = await s.list();
    expect(all.map((r) => r.runId)).toEqual(['run-1']);
  });

  it('list() returns runs ordered by lastUpdatedAt desc', async () => {
    const s1 = store(() => new Date('2026-04-20T00:00:10.000Z'));
    await s1.create(baseOpts);
    const s2 = store(() => new Date('2026-04-20T00:00:20.000Z'));
    await s2.create({ ...baseOpts, runId: 'run-2' });
    const s3 = store(() => new Date('2026-04-20T00:00:30.000Z'));
    await s3.update('run-1', { phase: 'planning' });

    const all = await s3.list();
    expect(all.map((r) => r.runId)).toEqual(['run-1', 'run-2']);
  });

  it('latest() returns the most recently touched run', async () => {
    const s = store();
    await s.create(baseOpts);
    await s.create({ ...baseOpts, runId: 'run-2' });
    const latest = await s.latest();
    expect(['run-1', 'run-2']).toContain(latest?.runId);
  });

  it('latestStarted() returns the run with the newest startedAt, not lastUpdatedAt', async () => {
    const s = createStateStore({ repoRoot });
    await s.create({
      ...baseOpts,
      runId: 'older',
      now: () => new Date('2026-04-20T00:00:00.000Z'),
    });
    await s.create({
      ...baseOpts,
      runId: 'newer',
      now: () => new Date('2026-04-21T00:00:00.000Z'),
    });
    await s.update('older', { phase: 'planning' });

    expect((await s.latest())?.runId).toBe('older');
    expect((await s.latestStarted())?.runId).toBe('newer');
  });

  it('delete() removes the run directory', async () => {
    const s = store();
    await s.create(baseOpts);
    await s.delete('run-1');
    expect(await s.load('run-1')).toBeNull();
  });

  it('list() returns [] when runs directory is absent', async () => {
    const s = store();
    expect(await s.list()).toEqual([]);
  });

  it('propagates completion to meta.json', async () => {
    const s = store();
    await s.create(baseOpts);
    await s.update('run-1', {
      status: 'completed',
      phase: 'completed',
      completedAt: '2026-04-20T00:01:00.000Z',
    });
    const meta = await s.loadMeta('run-1');
    expect(meta?.completedAt).toBe('2026-04-20T00:01:00.000Z');
  });
});
