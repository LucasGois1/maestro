import type { Dirent } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';

import { writeAtomicJson } from './atomic.js';
import {
  runMetaPath,
  runRoot,
  runStatePath,
  runsRoot,
  type RunPathOptions,
} from './paths.js';
import {
  runMetaSchema,
  runStateSchema,
  type PipelineStage,
  type RunMeta,
  type RunState,
} from './schema.js';

export class StateStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateStoreError';
  }
}

export type CreateRunOptions = {
  readonly runId: string;
  readonly branch: string;
  readonly worktreePath: string;
  readonly prompt: string;
  readonly userAgent: string;
  readonly providerDefaults: Readonly<Record<string, string>>;
  readonly phase?: PipelineStage;
  readonly now?: () => Date;
};

export interface StateStore {
  create(options: CreateRunOptions): Promise<RunState>;
  load(runId: string): Promise<RunState | null>;
  loadMeta(runId: string): Promise<RunMeta | null>;
  update(runId: string, patch: Partial<RunState>): Promise<RunState>;
  list(): Promise<RunState[]>;
  latest(): Promise<RunState | null>;
  /** Most recent run by `startedAt` (chronologically last started), for `/resume` without id. */
  latestStarted(): Promise<RunState | null>;
  delete(runId: string): Promise<void>;
}

export type CreateStateStoreOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
  readonly now?: () => Date;
};

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}

async function readJsonIfExists(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

export function createStateStore(options: CreateStateStoreOptions): StateStore {
  const { repoRoot, maestroDir } = options;
  const clock = options.now ?? (() => new Date());

  function runPathOpts(runId: string): RunPathOptions {
    const base: RunPathOptions = { repoRoot, runId };
    return maestroDir !== undefined ? { ...base, maestroDir } : base;
  }

  async function readState(runId: string): Promise<RunState | null> {
    const path = runStatePath(runPathOpts(runId));
    const raw = await readJsonIfExists(path);
    if (raw === null) return null;
    return runStateSchema.parse(raw);
  }

  async function readMeta(runId: string): Promise<RunMeta | null> {
    const path = runMetaPath(runPathOpts(runId));
    const raw = await readJsonIfExists(path);
    if (raw === null) return null;
    return runMetaSchema.parse(raw);
  }

  async function writeState(state: RunState): Promise<void> {
    const path = runStatePath(runPathOpts(state.runId));
    await writeAtomicJson(path, state);
  }

  async function writeMeta(meta: RunMeta): Promise<void> {
    const path = runMetaPath(runPathOpts(meta.runId));
    await writeAtomicJson(path, meta);
  }

  return {
    async create(opts) {
      const startedAt = (opts.now ?? clock)().toISOString();
      const state: RunState = runStateSchema.parse({
        runId: opts.runId,
        version: 1,
        status: 'running',
        phase: opts.phase ?? 'idle',
        branch: opts.branch,
        worktreePath: opts.worktreePath,
        startedAt,
        lastUpdatedAt: startedAt,
        metadata: {
          prompt: opts.prompt,
          userAgent: opts.userAgent,
          providerDefaults: { ...opts.providerDefaults },
        },
      });
      await writeState(state);
      await writeMeta({
        runId: state.runId,
        startedAt,
        prompt: opts.prompt,
        branch: opts.branch,
        userAgent: opts.userAgent,
      });
      return state;
    },

    async load(runId) {
      return readState(runId);
    },

    async loadMeta(runId) {
      return readMeta(runId);
    },

    async update(runId, patch) {
      const current = await readState(runId);
      if (!current) {
        throw new StateStoreError(`No run with id "${runId}"`);
      }
      const merged = runStateSchema.parse({
        ...current,
        ...patch,
        runId: current.runId,
        version: 1,
        lastUpdatedAt: clock().toISOString(),
      });
      await writeState(merged);
      if (merged.status === 'completed' && merged.completedAt !== undefined) {
        const meta = await readMeta(runId);
        if (meta && meta.completedAt === undefined) {
          await writeMeta({ ...meta, completedAt: merged.completedAt });
        }
      }
      return merged;
    },

    async list() {
      const root = runsRoot(repoRoot, maestroDir);
      let dirents: Dirent[];
      try {
        dirents = await readdir(root, { withFileTypes: true });
      } catch (error) {
        if (isEnoent(error)) return [];
        throw error;
      }
      const states: RunState[] = [];
      for (const dirent of dirents) {
        if (!dirent.isDirectory()) continue;
        const state = await readState(dirent.name);
        if (state) states.push(state);
      }
      return states.sort((a, b) =>
        b.lastUpdatedAt.localeCompare(a.lastUpdatedAt),
      );
    },

    async latest() {
      const all = await this.list();
      return all[0] ?? null;
    },

    async latestStarted() {
      const all = await this.list();
      if (all.length === 0) return null;
      return (
        [...all].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ??
        null
      );
    },

    async delete(runId) {
      const dir = runRoot(runPathOpts(runId));
      try {
        await rm(dir, { recursive: true, force: true });
      } catch (error) {
        if (!isEnoent(error)) throw error;
      }
    },
  };
}
