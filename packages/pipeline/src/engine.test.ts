import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createStateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ArchitectModelOutput,
  EvaluatorModelOutput,
  GeneratorModelOutput,
  MergerModelOutput,
  PlannerModelOutput,
} from '@maestro/agents';

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

/** Three sprints for architect integration coverage. */
const plannerModelOutputThreeSprints: PlannerModelOutput = {
  feature: 'Payments',
  overview: 'End-to-end payments.',
  userStories: [
    { id: 1, role: 'user', action: 'pay', value: 'checkout' },
    { id: 2, role: 'admin', action: 'reconcile', value: 'reports' },
    { id: 3, role: 'ops', action: 'audit', value: 'compliance' },
  ],
  aiFeatures: [],
  sprints: [
    {
      idx: 1,
      name: 'Checkout API',
      objective: 'API',
      userStoryIds: [1],
      dependsOn: [],
      complexity: 'medium',
      keyFeatures: ['API'],
    },
    {
      idx: 2,
      name: 'Reconciliation',
      objective: 'Recon',
      userStoryIds: [2],
      dependsOn: [1],
      complexity: 'high',
      keyFeatures: ['Batch'],
    },
    {
      idx: 3,
      name: 'Audit log',
      objective: 'Audit',
      userStoryIds: [3],
      dependsOn: [2],
      complexity: 'low',
      keyFeatures: ['Log'],
    },
  ],
};

function expectNormalizedPlan(p: PlannerOutput): void {
  expect(p.sprints.length).toBe(2);
  expect(p.summary.length).toBeGreaterThan(0);
}

beforeEach(async () => {
  repoRoot = await mkdtemp(join(tmpdir(), 'maestro-pipeline-'));
  await mkdir(join(repoRoot, '.maestro'), { recursive: true });
  await writeFile(
    join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
    '# Architecture\n\nModule boundaries and layers as documented.\n',
    'utf8',
  );
});

function mockArchitectOk(input: unknown): ArchitectModelOutput {
  const i = input as { sprint: { idx: number } };
  return {
    sprintIdx: i.sprint.idx,
    scopeTecnico: { newFiles: [], filesToTouch: [], testFiles: [] },
    patternsToFollow: ['Follow repo conventions.'],
    libraries: [],
    boundaryCheck: 'ok',
  };
}

function mockGeneratorOk(input: unknown): GeneratorModelOutput {
  const i = input as { sprint: { idx: number } };
  return {
    sprintIdx: i.sprint.idx,
    filesChanged: [{ path: 'a.ts', changeType: 'added' }],
    commits: [{ sha: 'c0ffee', message: 'feat(test): stub' }],
    selfEval: {
      coversAllCriteria: true,
      missingCriteria: [],
      concerns: [],
    },
    handoffNotes: 'Stub handoff.',
  };
}

function mockEvaluatorPassed(): EvaluatorModelOutput {
  return {
    decision: 'passed',
    structuredFeedback: '## Summary\nStub evaluator OK.',
    sensorsRun: [],
    artifacts: [],
    suggestedActions: [],
  };
}

function mockMergerModelOutput(branch: string): MergerModelOutput {
  return {
    runStatus: 'completed',
    branch,
    commitCount: 1,
    execPlanPath: '.maestro/docs/exec-plans/completed/placeholder.md',
    cleanupDone: false,
    summary: 'ok',
  };
}

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
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
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

    const feedbackMd = await readFile(
      join(
        repoRoot,
        '.maestro',
        'runs',
        'r1',
        'feedback',
        'sprint-1-eval-1.md',
      ),
      'utf8',
    );
    expect(feedbackMd).toContain('decision: passed');
    expect(feedbackMd).toContain('Stub evaluator OK.');
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
    expect(planText).toContain('### Architect notes');
    expect(planText).toContain('## Boundary check');

    const dn1 = join(
      repoRoot,
      '.maestro',
      'runs',
      'r1',
      'design-notes',
      'design-notes-sprint-1.md',
    );
    await expect(readFile(dn1, 'utf8')).resolves.toContain('Design notes');

    const selfEval1 = join(
      repoRoot,
      '.maestro',
      'runs',
      'r1',
      'checkpoints',
      'sprint-1-self-eval.md',
    );
    await expect(readFile(selfEval1, 'utf8')).resolves.toContain(
      'Self-evaluation',
    );

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

  it('appends project log and writes completed exec-plan after merger', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    const result = await runPipeline({
      runId: 'r-exec',
      prompt: 'ship auth',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    const logText = await readFile(
      join(repoRoot, '.maestro', 'log.md'),
      'utf8',
    );
    expect(logText).toContain('pipeline.completed');
    expect(logText).toContain('r-exec');

    expect(result.merger.execPlanPath).toContain('exec-plans/completed');
    const execAbs = join(repoRoot, result.merger.execPlanPath);
    await expect(readFile(execAbs, 'utf8')).resolves.toContain('# Exec plan');
    await expect(readFile(execAbs, 'utf8')).resolves.toContain('Auth');
  });

  it('passes requireDraftPr from config into merger input', async () => {
    const env = makeEnv();
    let captured: unknown;
    const config = configSchema.parse({
      merger: {
        removeWorktreeOnSuccess: false,
        requireDraftPr: true,
      },
    });
    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: (input) => {
        captured = input;
        return mockMergerModelOutput('maestro/demo');
      },
    });

    await runPipeline({
      runId: 'r-draft',
      prompt: 'ship',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config,
      executor,
    });

    expect(captured).toMatchObject({ requireDraftPr: true });
  });

  it('runs architect for three sprints and writes three design-note files', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutputThreeSprints,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    await runPipeline({
      runId: 'r3',
      prompt: 'payments',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    for (const n of [1, 2, 3]) {
      const p = join(
        repoRoot,
        '.maestro',
        'runs',
        'r3',
        'design-notes',
        `design-notes-sprint-${n.toString()}.md`,
      );
      await expect(readFile(p, 'utf8')).resolves.toContain('Design notes');
    }

    const planPath = join(repoRoot, '.maestro', 'runs', 'r3', 'plan.md');
    const planText = await readFile(planPath, 'utf8');
    const architectNoteHeadings = planText.match(/### Architect notes/gu);
    expect(architectNoteHeadings?.length).toBe(3);
    expect(planText).toMatch(
      /### Sprint 1 — Checkout API[\s\S]*?### Architect notes/u,
    );
    expect(planText).toMatch(
      /### Sprint 2 — Reconciliation[\s\S]*?### Architect notes/u,
    );
    expect(planText).toMatch(
      /### Sprint 3 — Audit log[\s\S]*?### Architect notes/u,
    );
  });

  it('passes evaluatorFeedback into generator input on retry', async () => {
    const env = makeEnv();
    const generatorInputs: unknown[] = [];
    let evalCalls = 0;
    const oneSprintPlan: PlannerModelOutput = {
      ...plannerModelOutput,
      sprints: [plannerModelOutput.sprints[0]!],
    };
    const executor = buildExecutor({
      planner: () => oneSprintPlan,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => {
        generatorInputs.push(input);
        return mockGeneratorOk(input);
      },
      evaluator: () => {
        evalCalls += 1;
        if (evalCalls < 2) {
          return {
            decision: 'failed' as const,
            structuredFeedback:
              '## Gap\nLINE:42 user-facing message still generic.',
            sensorsRun: [],
            artifacts: [],
            suggestedActions: ['need more work'],
          };
        }
        return mockEvaluatorPassed();
      },
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    await runPipeline({
      runId: 'r-feed',
      prompt: 'x',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
      retries: 3,
    });

    expect(generatorInputs).toHaveLength(2);
    expect(generatorInputs[1]).toMatchObject({
      evaluatorFeedback: {
        failures: ['need more work'],
        structuredFeedback:
          '## Gap\nLINE:42 user-facing message still generic.',
        suggestedActions: ['need more work'],
        decision: 'failed',
      },
    });
  });

  it('persists three new files from generator output in handoff', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => {
        const i = input as { sprint: { idx: number } };
        return {
          sprintIdx: i.sprint.idx,
          filesChanged: [
            { path: 'one.ts', changeType: 'added' as const },
            { path: 'two.ts', changeType: 'added' as const },
            { path: 'three.ts', changeType: 'added' as const },
          ],
          commits: [
            {
              sha: 'abc',
              message: 'feat(app): add three modules',
            },
          ],
          selfEval: {
            coversAllCriteria: true,
            missingCriteria: [],
            concerns: [],
          },
          handoffNotes: 'Three files added.',
        };
      },
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    await runPipeline({
      runId: 'r-three',
      prompt: 'y',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    const handoff = await readFile(
      join(
        repoRoot,
        '.maestro',
        'runs',
        'r-three',
        'checkpoints',
        'sprint-1-handoff.md',
      ),
      'utf8',
    );
    expect(handoff).toContain('one.ts');
    expect(handoff).toContain('two.ts');
    expect(handoff).toContain('three.ts');
  });
});

describe('runPipeline (retry + escalation)', () => {
  it('retries the generator up to the budget then escalates', async () => {
    const env = makeEnv();
    const attemptsBySprint = [0, 0];

    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => {
        attemptsBySprint[0] = (attemptsBySprint[0] ?? 0) + 1;
        return mockGeneratorOk(input);
      },
      evaluator: () => ({
        decision: 'failed' as const,
        structuredFeedback: '## Summary\nacceptance missing',
        sensorsRun: [],
        artifacts: [],
        suggestedActions: ['acceptance missing'],
      }),
      merger: () => mockMergerModelOutput('x'),
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
      architect: (input) => {
        controller.abort();
        return mockArchitectOk(input);
      },
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('x'),
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
      architect: (input) => {
        controller.abort();
        return mockArchitectOk(input);
      },
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('x'),
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
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('x'),
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
