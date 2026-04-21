import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createStateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlannerModelOutput } from '@maestro/agents';

import { runPipeline, type PlannerOutput } from './engine.js';
import { PipelineEscalationError, PipelinePauseError } from './errors.js';
import type { AgentExecutor } from './executor.js';
import { resumePipeline } from './resume.js';

let repoRoot: string;

/** Raw model JSON consumed by `normalizePlannerModelOutput` inside `runPipeline`. */
const plannerModelOutput: PlannerModelOutput = {
  feature: 'Auth',
  overview: 'Ship authentication end-to-end.\nCoverage for sessions.',
  userStories: [
    {
      id: 1,
      role: 'user',
      action: 'sign in',
      value: 'access my account',
    },
    {
      id: 2,
      role: 'admin',
      action: 'revoke sessions',
      value: 'team security',
    },
  ],
  aiFeatures: [],
  sprints: [
    {
      idx: 1,
      name: 'Session bootstrap',
      objective: 'Session bootstrap',
      userStoryIds: [1],
      dependsOn: [],
      complexity: 'medium',
      keyFeatures: ['Secure cookies'],
    },
    {
      idx: 2,
      name: 'JWT service',
      objective: 'JWT service',
      userStoryIds: [2],
      dependsOn: [1],
      complexity: 'high',
      keyFeatures: ['Token refresh'],
    },
  ],
};

function expectNormalizedPlan(p: PlannerOutput): void {
  expect(p.sprints.length).toBe(2);
  expect(p.summary.length).toBeGreaterThan(0);
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-pipeline-'));
});

afterEach(async () => {
  await rm(repoRoot, { recursive: true, force: true });
});

function makeEnv() {
  const store = createStateStore({ repoRoot });
  const bus = createEventBus();
  const events: MaestroEvent[] = [];
  bus.on((e) => events.push(e));
  const config = configSchema.parse({});
  return { store, bus, events, config };
}

function buildExecutor(
  map: Record<string, (input: unknown) => unknown>,
): AgentExecutor {
  const executor: AgentExecutor = async ({ definition, input }) => {
    const fn = map[definition.id];
    if (!fn) throw new Error(`No stub for agent ${definition.id}`);
    return fn(input) as never;
  };
  return executor;
}

describe('runPipeline (happy path)', () => {
  it('runs Planner → Architect → Generator → Evaluator → Merger and completes', async () => {
    const env = makeEnv();

    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: () => ({ approved: true, violations: [] }),
      generator: () => ({
        summary: 'done',
        changedFiles: ['a.ts'],
        followUps: [],
      }),
      evaluator: () => ({ pass: true, failures: [] }),
      merger: () => ({
        branch: 'maestro/demo',
        summary: 'ok',
      }),
    });

    const result = await runPipeline({
      runId: 'r1',
      prompt: 'ship auth',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    expect(result.state.status).toBe('completed');
    expect(result.state.phase).toBe('completed');
    expect(result.sprintOutcomes).toHaveLength(2);
    expect(result.sprintOutcomes[0]?.attempts).toBe(1);
    expectNormalizedPlan(result.plan);

    const types = env.events.map((e) => e.type);
    expect(types).toContain('pipeline.started');
    expect(types.filter((t) => t === 'pipeline.sprint_started')).toHaveLength(
      2,
    );
    expect(types).toContain('pipeline.completed');

    const planPath = join(repoRoot, '.maestro', 'runs', 'r1', 'plan.md');
    const planText = await readFile(planPath, 'utf8');
    expect(planText).toMatch(/^---\n/u);
    expect(planText).toContain('run_id');
    expect(planText).toContain('Auth');
    expect(planText).toContain('## User stories principais');

    const contractPath = join(
      repoRoot,
      '.maestro',
      'runs',
      'r1',
      'contracts',
      'sprint-1.md',
    );
    await expect(readFile(contractPath, 'utf8')).resolves.toMatch(/^---/u);

    const handoffPath = join(
      repoRoot,
      '.maestro',
      'runs',
      'r1',
      'checkpoints',
      'sprint-1-handoff.md',
    );
    await expect(readFile(handoffPath, 'utf8')).resolves.toMatch(
      /Sprint 1 — Handoff/,
    );
  });
});

describe('runPipeline (retry + escalation)', () => {
  it('retries the generator up to the budget then escalates', async () => {
    const env = makeEnv();
    const attemptsBySprint = [0, 0];

    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: () => ({ approved: true, violations: [] }),
      generator: () => {
        attemptsBySprint[0] = (attemptsBySprint[0] ?? 0) + 1;
        return { summary: '', changedFiles: [], followUps: [] };
      },
      evaluator: () => ({ pass: false, failures: ['acceptance missing'] }),
      merger: () => ({ branch: 'x', summary: 'y' }),
    });

    await expect(
      runPipeline({
        runId: 'r-escal',
        prompt: 'fail fast',
        branch: 'maestro/demo',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
        retries: 2,
      }),
    ).rejects.toBeInstanceOf(PipelineEscalationError);

    expect(attemptsBySprint[0]).toBe(2);

    const state = await env.store.load('r-escal');
    expect(state?.status).toBe('paused');
    expect(state?.phase).toBe('escalated');
    expect(state?.escalation?.sprintIdx).toBe(0);

    const retried = env.events.filter(
      (e) => e.type === 'pipeline.sprint_retried',
    );
    expect(retried).toHaveLength(1);
    expect(env.events.some((e) => e.type === 'pipeline.sprint_escalated')).toBe(
      true,
    );
  });
});

describe('runPipeline (graceful pause)', () => {
  it('stops at next phase boundary when the abort signal fires', async () => {
    const env = makeEnv();
    const controller = new AbortController();

    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: () => {
        controller.abort();
        return { approved: true, violations: [] };
      },
      generator: () => ({
        summary: '',
        changedFiles: [],
        followUps: [],
      }),
      evaluator: () => ({ pass: true, failures: [] }),
      merger: () => ({ branch: 'x', summary: 'y' }),
    });

    await expect(
      runPipeline({
        runId: 'r-pause',
        prompt: 'pause me',
        branch: 'maestro/demo',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
        abortSignal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(PipelinePauseError);

    const paused = env.events.find((e) => e.type === 'pipeline.paused');
    expect(paused).toBeDefined();
    const state = await env.store.load('r-pause');
    expect(state?.status).toBe('paused');
  });
});

describe('resumePipeline', () => {
  it('resumes the latest paused run and emits pipeline.resumed', async () => {
    const env = makeEnv();
    const controller = new AbortController();

    const firstExecutor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: () => {
        controller.abort();
        return { approved: true, violations: [] };
      },
      generator: () => ({ summary: '', changedFiles: [], followUps: [] }),
      evaluator: () => ({ pass: true, failures: [] }),
      merger: () => ({ branch: 'x', summary: 'y' }),
    });

    await expect(
      runPipeline({
        runId: 'r-resume',
        prompt: 'will pause',
        branch: 'maestro/demo',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor: firstExecutor,
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow();

    const resumed: MaestroEvent[] = [];
    const resumeBus = createEventBus();
    resumeBus.on((e) => resumed.push(e));

    const finishExecutor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: () => ({ approved: true, violations: [] }),
      generator: () => ({ summary: '', changedFiles: [], followUps: [] }),
      evaluator: () => ({ pass: true, failures: [] }),
      merger: () => ({ branch: 'x', summary: 'y' }),
    });

    const result = await resumePipeline({
      store: env.store,
      bus: resumeBus,
      config: env.config,
      executor: finishExecutor,
      repoRoot,
    });

    expect(result.state.status).toBe('completed');
    expect(resumed.some((e) => e.type === 'pipeline.resumed')).toBe(true);
  });

  it('throws when there is no run to resume', async () => {
    const env = makeEnv();
    await expect(
      resumePipeline({
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor: vi.fn(),
        repoRoot,
      }),
    ).rejects.toThrow(/No run/);
  });
});
