import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configSchema } from '@maestro/config';
import { parseSprintContract } from '@maestro/contract';
import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createStateStore } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AgentContext,
  ArchitectModelOutput,
  ArchitectPipelineResult,
  EvaluatorModelOutput,
  GeneratorModelOutput,
  MergerModelOutput,
  PlannerModelOutput,
} from '@maestro/agents';
import { normalizePlannerModelOutput } from '@maestro/agents';

import {
  contractScopeFromArchitect,
  DEFAULT_MAX_PLAN_REPLANS,
  runPipeline,
  type PlannerOutput,
} from './engine.js';
import { PipelineEscalationError, PipelinePauseError } from './errors.js';
import type { AgentExecutor } from './executor.js';
import { serializePlanMarkdown } from './plan-markdown.js';
import { resumePipeline } from './resume.js';

let repoRoot: string;

/** Raw model JSON consumed by `normalizePlannerModelOutput` inside `runPipeline`. */
const plannerModelOutput: PlannerModelOutput = {
  kind: 'plan',
  escalationReason: null,
  questions: null,
  continuePrompt: null,
  summaryMarkdown: null,
  interviewState: null,
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
  kind: 'plan',
  escalationReason: null,
  questions: null,
  continuePrompt: null,
  summaryMarkdown: null,
  interviewState: null,
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
    boundaryNotes: null,
    escalation: null,
  };
}

function mockArchitectRefactorNeeded(input: unknown): ArchitectModelOutput {
  const i = input as { sprint: { idx: number } };
  return {
    sprintIdx: i.sprint.idx,
    scopeTecnico: { newFiles: [], filesToTouch: [], testFiles: [] },
    patternsToFollow: [],
    libraries: [],
    boundaryCheck: 'refactor_needed',
    boundaryNotes: 'Narrow scope before implementation.',
    escalation: null,
  };
}

/** Architect OK with concrete paths (contract `scope` must mirror these). */
function mockArchitectOkWithFileScope(input: unknown): ArchitectModelOutput {
  const i = input as { sprint: { idx: number } };
  return {
    sprintIdx: i.sprint.idx,
    scopeTecnico: {
      newFiles: [{ path: 'src/new-module.ts', layer: 'app' }],
      filesToTouch: ['CONTRIBUTING.md', 'src/existing.ts'],
      testFiles: ['src/existing.test.ts'],
    },
    patternsToFollow: ['Follow repo conventions.'],
    libraries: [],
    boundaryCheck: 'ok',
    boundaryNotes: null,
    escalation: null,
  };
}

/** Doc in-place only: drives files_expected from filesToTouch. */
function mockArchitectDocInPlaceOnly(input: unknown): ArchitectModelOutput {
  const i = input as { sprint: { idx: number } };
  return {
    sprintIdx: i.sprint.idx,
    scopeTecnico: {
      newFiles: [],
      filesToTouch: ['docs/HANDBOOK.md'],
      testFiles: [],
    },
    patternsToFollow: [],
    libraries: [],
    boundaryCheck: 'ok',
    boundaryNotes: null,
    escalation: null,
  };
}

/** Single-sprint plan after a simulated Architect-driven replan. */
const plannerModelOutputNarrow: PlannerModelOutput = {
  kind: 'plan',
  escalationReason: null,
  questions: null,
  continuePrompt: null,
  summaryMarkdown: null,
  interviewState: null,
  feature: 'Narrow slice',
  overview: 'One sprint only.',
  userStories: [
    { id: 1, role: 'dev', action: 'ship', value: 'minimal change' },
  ],
  aiFeatures: [],
  sprints: [
    {
      idx: 1,
      name: 'Minimal',
      objective: 'Minimal objective',
      userStoryIds: [1],
      dependsOn: [],
      complexity: 'low',
      keyFeatures: ['Docs'],
    },
  ],
};

const plannerInterviewQuestions: PlannerModelOutput = {
  kind: 'questions',
  escalationReason: null,
  questions: [
    {
      id: 'q1',
      prompt: 'Qual e o objetivo principal da feature?',
      topic: 'goal',
    },
    {
      id: 'q2',
      prompt: 'Existe alguma restricao obrigatoria?',
      topic: 'constraints',
    },
  ],
  continuePrompt: null,
  summaryMarkdown: null,
  interviewState: {
    stage: 'start',
    roundInBlock: 1,
    blockIndex: 1,
    totalRounds: 1,
    transcript: [],
    latestAnswers: [],
    context: {
      goals: [],
      personas: [],
      requirements: [],
      flows: [],
      businessRules: [],
      constraints: [],
      outOfScope: [],
      assumptions: [],
      openQuestions: ['Objetivo principal da feature'],
    },
  },
  feature: null,
  overview: null,
  userStories: null,
  aiFeatures: null,
  sprints: null,
};

const plannerInterviewSummary: PlannerModelOutput = {
  kind: 'summary',
  escalationReason: null,
  questions: null,
  continuePrompt: null,
  summaryMarkdown:
    '## Resumo\n\n- Objetivo: autenticar usuarios.\n- Restricoes: manter cookies seguros.',
  interviewState: {
    stage: 'summary_review',
    roundInBlock: 1,
    blockIndex: 1,
    totalRounds: 1,
    transcript: [
      {
        role: 'planner',
        kind: 'question',
        text: 'Qual e o objetivo principal da feature?',
        topic: 'goal',
        questionId: 'q1',
        round: 1,
      },
      {
        role: 'user',
        kind: 'answer',
        text: 'Autenticar usuarios com sessoes seguras.',
        topic: 'goal',
        questionId: 'q1',
        round: 1,
      },
    ],
    latestAnswers: [
      {
        questionId: 'q1',
        answer: 'Autenticar usuarios com sessoes seguras.',
      },
      {
        questionId: 'q2',
        answer: 'Usar cookies seguros.',
      },
    ],
    context: {
      goals: ['Autenticar usuarios com sessoes seguras.'],
      personas: [],
      requirements: ['Login com sessao'],
      flows: [],
      businessRules: [],
      constraints: ['Usar cookies seguros'],
      outOfScope: [],
      assumptions: [],
      openQuestions: [],
    },
  },
  feature: null,
  overview: null,
  userStories: null,
  aiFeatures: null,
  sprints: null,
};

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
    coverage: null,
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
    prUrl: null,
    prNumber: null,
    summary: 'ok',
    prTitle: null,
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
    const contractText = await readFile(contractPath, 'utf8');
    expect(contractText).toMatch(/^---/u);
    expect(contractText).toContain('files_expected: []');
    expect(contractText).toContain('files_may_touch: []');
    expect(parseSprintContract(contractText).frontmatter.depends_on).toEqual(
      [],
    );

    const contract2Path = join(
      repoRoot,
      '.maestro',
      'runs',
      'r1',
      'contracts',
      'sprint-2.md',
    );
    expect(
      parseSprintContract(await readFile(contract2Path, 'utf8')).frontmatter
        .depends_on,
    ).toEqual([1]);

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

  it('seeds sprint contract scope from architect scopeTecnico', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutputNarrow,
      architect: (input) => mockArchitectOkWithFileScope(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/scope'),
    });

    await runPipeline({
      runId: 'r-scope',
      prompt: 'narrow',
      branch: 'maestro/scope',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    const contractPath = join(
      repoRoot,
      '.maestro',
      'runs',
      'r-scope',
      'contracts',
      'sprint-1.md',
    );
    const parsed = parseSprintContract(await readFile(contractPath, 'utf8'));
    expect(parsed.frontmatter.scope.files_expected).toEqual([
      'CONTRIBUTING.md',
      'src/existing.ts',
    ]);
    expect(parsed.frontmatter.scope.files_may_touch).toEqual(
      expect.arrayContaining([
        'CONTRIBUTING.md',
        'src/existing.ts',
        'src/new-module.ts',
        'src/existing.test.ts',
      ]),
    );
    expect(parsed.frontmatter.scope.files_may_touch).toHaveLength(4);
  });

  it('seeds contract scope from filesToTouch-only doc path (newFiles empty)', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutputNarrow,
      architect: (input) => mockArchitectDocInPlaceOnly(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/doc-scope'),
    });

    await runPipeline({
      runId: 'r-doc-scope',
      prompt: 'narrow',
      branch: 'maestro/doc-scope',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
    });

    const contractPath = join(
      repoRoot,
      '.maestro',
      'runs',
      'r-doc-scope',
      'contracts',
      'sprint-1.md',
    );
    const parsed = parseSprintContract(await readFile(contractPath, 'utf8'));
    expect(parsed.frontmatter.scope.files_expected).toEqual(['docs/HANDBOOK.md']);
    expect(parsed.frontmatter.scope.files_may_touch).toEqual(['docs/HANDBOOK.md']);
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
    const fixtureSprints = plannerModelOutput.sprints;
    if (fixtureSprints === null || fixtureSprints.length === 0) {
      throw new Error('planner fixture must contain at least one sprint');
    }
    const firstSprint = fixtureSprints[0];
    if (!firstSprint) {
      throw new Error('planner fixture must contain at least one sprint');
    }
    const oneSprintPlan: PlannerModelOutput = {
      ...plannerModelOutput,
      sprints: [firstSprint],
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

  it('binds agent workingDir to worktree and passes dual roots to generator input', async () => {
    const env = makeEnv();
    const wt = await mkdtemp(join(tmpdir(), 'maestro-pipeline-wt-'));

    const contexts: AgentContext[] = [];
    const generatorInputs: unknown[] = [];
    const architectInputs: unknown[] = [];

    const executor: AgentExecutor = async ({ definition, input, context }) => {
      contexts.push(context);
      if (definition.id === 'architect') {
        architectInputs.push(input);
      }
      if (definition.id === 'generator') {
        generatorInputs.push(input);
      }
      const fn = (
        {
          planner: () => plannerModelOutputNarrow,
          architect: (inp: unknown) => mockArchitectOk(inp),
          generator: (inp: unknown) => mockGeneratorOk(inp),
          evaluator: () => mockEvaluatorPassed(),
          merger: () => mockMergerModelOutput('maestro/demo'),
        } as const
      )[
        definition.id as
          | 'planner'
          | 'architect'
          | 'generator'
          | 'evaluator'
          | 'merger'
      ];
      if (!fn) throw new Error(`No stub for ${definition.id}`);
      return fn(input as never) as never;
    };

    try {
      await runPipeline({
        runId: 'r-wt',
        prompt: 'x',
        branch: 'feat/wt',
        worktreePath: wt,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
      });

      const byAgent = new Map(contexts.map((c) => [c.agentId, c]));
      for (const id of [
        'planner',
        'architect',
        'generator',
        'evaluator',
        'merger',
      ] as const) {
        const c = byAgent.get(id);
        expect(c?.workingDir).toBe(wt);
        expect(c?.metadata.stateRepoRoot).toBe(repoRoot);
        expect(c?.metadata.worktreeRoot).toBe(wt);
      }

      expect(generatorInputs[0]).toMatchObject({
        implementationRoot: wt,
        stateRepoRoot: repoRoot,
      });

      expect(architectInputs[0]).toMatchObject({
        architecture: expect.stringContaining(
          'Module boundaries and layers as documented.',
        ),
      });
    } finally {
      await rm(wt, { recursive: true, force: true });
    }
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

describe('runPipeline (plan replan)', () => {
  it('reruns Planner with replan context then completes when Architect approves', async () => {
    const env = makeEnv();
    let plannerCalls = 0;
    let architectCalls = 0;
    const executor = buildExecutor({
      planner: (input) => {
        plannerCalls += 1;
        const inp = input as { replan?: { attempt: number } };
        if (plannerCalls === 1) {
          expect(inp.replan).toBeUndefined();
          return plannerModelOutput;
        }
        expect(inp.replan).toBeDefined();
        expect(inp.replan?.attempt).toBe(1);
        return plannerModelOutputNarrow;
      },
      architect: (input) => {
        architectCalls += 1;
        if (architectCalls === 1) {
          return mockArchitectRefactorNeeded(input);
        }
        return mockArchitectOk(input);
      },
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    const result = await runPipeline({
      runId: 'r-replan',
      prompt: 'ship',
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
      maxPlanReplans: DEFAULT_MAX_PLAN_REPLANS,
    });

    expect(plannerCalls).toBe(2);
    expect(architectCalls).toBeGreaterThanOrEqual(2);
    expect(result.plan.sprints).toHaveLength(1);
    expect(result.state.status).toBe('completed');
    expect(env.events.some((e) => e.type === 'pipeline.plan_revised')).toBe(
      true,
    );
  });

  it('escalates after replan budget is exhausted', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerModelOutput,
      architect: (input) => mockArchitectRefactorNeeded(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    await expect(
      runPipeline({
        runId: 'r-replan-exhaust',
        prompt: 'ship',
        branch: 'maestro/demo',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
        maxPlanReplans: 1,
      }),
    ).rejects.toBeInstanceOf(PipelineEscalationError);

    const revised = env.events.filter(
      (e) => e.type === 'pipeline.plan_revised',
    );
    expect(revised).toHaveLength(1);
  });
});

describe('resumePipeline', () => {
  it('resumes the last-started run when no id is passed and emits pipeline.resumed', async () => {
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

  it('resume with plan snapshot skips planner and architect when sprint artifacts exist', async () => {
    const env = makeEnv();
    const runId = 'r-snapshot-resume';
    const oneSprintPlanner: PlannerModelOutput = {
      kind: 'plan',
      escalationReason: null,
      questions: null,
      continuePrompt: null,
      summaryMarkdown: null,
      interviewState: null,
      feature: 'Solo',
      overview: 'Single sprint resume fixture.',
      userStories: [{ id: 1, role: 'user', action: 'x', value: 'y' }],
      aiFeatures: [],
      sprints: [
        {
          idx: 1,
          name: 'Only',
          objective: 'Only sprint',
          userStoryIds: [1],
          dependsOn: [],
          complexity: 'low',
          keyFeatures: ['a'],
        },
      ],
    };
    const plan = normalizePlannerModelOutput(oneSprintPlanner, {
      runId,
      prompt: 'resume me',
    });
    const runDir = join(repoRoot, '.maestro', 'runs', runId);
    await mkdir(join(runDir, 'contracts'), { recursive: true });
    await mkdir(join(runDir, 'design-notes'), { recursive: true });
    await writeFile(
      join(runDir, 'plan.snapshot.json'),
      JSON.stringify(plan),
      'utf8',
    );
    await writeFile(
      join(runDir, 'plan.md'),
      serializePlanMarkdown(plan),
      'utf8',
    );
    await writeFile(
      join(runDir, 'contracts', 'sprint-1.md'),
      '---\nsprint: 1\n---\nbody',
      'utf8',
    );
    await writeFile(
      join(runDir, 'design-notes', 'design-notes-sprint-1.md'),
      '# Design notes sprint 1\n',
      'utf8',
    );

    await env.store.create({
      runId,
      branch: 'maestro/demo',
      worktreePath: repoRoot,
      prompt: 'resume me',
      userAgent: 'test',
      providerDefaults: {},
    });
    await env.store.update(runId, {
      status: 'failed',
      phase: 'generating',
      failure: {
        message: 'generator boom',
        at: 'generating',
        failedAt: new Date().toISOString(),
      },
    });

    let plannerCalls = 0;
    let architectCalls = 0;
    const executor = buildExecutor({
      planner: () => {
        plannerCalls += 1;
        throw new Error('planner should not run');
      },
      architect: () => {
        architectCalls += 1;
        throw new Error('architect should not run');
      },
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/demo'),
    });

    const resumeBus = createEventBus();
    const result = await resumePipeline({
      runId,
      store: env.store,
      bus: resumeBus,
      config: env.config,
      executor,
      repoRoot,
    });

    expect(plannerCalls).toBe(0);
    expect(architectCalls).toBe(0);
    expect(result.state.status).toBe('completed');
  });
});

describe('runPipeline (planner interview)', () => {
  it('pauses in planning when the planner emits an interview round and persists artifacts', async () => {
    const env = makeEnv();
    const executor = buildExecutor({
      planner: () => plannerInterviewQuestions,
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/interview'),
    });

    await expect(
      runPipeline({
        runId: 'r-interview-1',
        prompt: 'ship auth',
        branch: 'maestro/interview',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
      }),
    ).rejects.toBeInstanceOf(PipelinePauseError);

    const state = await env.store.load('r-interview-1');
    expect(state?.status).toBe('paused');
    expect(state?.phase).toBe('planning');
    expect(state?.planningInterview?.mode).toBe('round');
    expect(env.events.map((event) => event.type)).toContain(
      'pipeline.planning_interview_pending',
    );

    const transcript = await readFile(
      join(
        repoRoot,
        '.maestro',
        'runs',
        'r-interview-1',
        'planning',
        'transcript.json',
      ),
      'utf8',
    );
    expect(transcript).toContain('"questions"');
  });

  it('resumes from interview answers, pauses on summary review, then completes after approval', async () => {
    const env = makeEnv();
    let plannerCalls = 0;
    const executor = buildExecutor({
      planner: () => {
        plannerCalls += 1;
        if (plannerCalls === 1) return plannerInterviewQuestions;
        if (plannerCalls === 2) return plannerInterviewSummary;
        return plannerModelOutput;
      },
      architect: (input) => mockArchitectOk(input),
      generator: (input) => mockGeneratorOk(input),
      evaluator: () => mockEvaluatorPassed(),
      merger: () => mockMergerModelOutput('maestro/interview-resume'),
    });

    await expect(
      runPipeline({
        runId: 'r-interview-2',
        prompt: 'ship auth',
        branch: 'maestro/interview-resume',
        worktreePath: repoRoot,
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
      }),
    ).rejects.toBeInstanceOf(PipelinePauseError);

    await expect(
      resumePipeline({
        runId: 'r-interview-2',
        repoRoot,
        store: env.store,
        bus: env.bus,
        config: env.config,
        executor,
        plannerInterviewResponse: {
          kind: 'answers',
          answers: [
            {
              questionId: 'q1',
              answer: 'Autenticar usuarios com sessao segura.',
            },
            {
              questionId: 'q2',
              answer: 'Cookies precisam ser seguros.',
            },
          ],
        },
      }),
    ).rejects.toBeInstanceOf(PipelinePauseError);

    const pausedOnSummary = await env.store.load('r-interview-2');
    expect(pausedOnSummary?.planningInterview?.mode).toBe('summary_review');

    const result = await resumePipeline({
      runId: 'r-interview-2',
      repoRoot,
      store: env.store,
      bus: env.bus,
      config: env.config,
      executor,
      plannerInterviewResponse: {
        kind: 'summary_review',
        feedback: null,
      },
    });

    expect(result.state.status).toBe('completed');
    expect(result.plan.feature).toBe('Auth');
    expect(plannerCalls).toBe(3);
  });
});

function architectScopeFixture(
  scope: ArchitectPipelineResult['scopeTecnico'],
): ArchitectPipelineResult {
  return {
    sprintIdx: 1,
    scopeTecnico: scope,
    patternsToFollow: [],
    libraries: [],
    boundaryCheck: 'ok',
    boundaryNotes: null,
    escalation: null,
    approved: true,
  };
}

describe('contractScopeFromArchitect', () => {
  it('returns undefined when scope lists are all empty', () => {
    expect(
      contractScopeFromArchitect(
        architectScopeFixture({ newFiles: [], filesToTouch: [], testFiles: [] }),
      ),
    ).toBeUndefined();
  });

  it('uses newFiles paths as files_expected when filesToTouch is empty', () => {
    expect(
      contractScopeFromArchitect(
        architectScopeFixture({
          newFiles: [{ path: 'src/a.ts', layer: 'app' }],
          filesToTouch: [],
          testFiles: [],
        }),
      ),
    ).toEqual({
      files_expected: ['src/a.ts'],
      files_may_touch: ['src/a.ts'],
    });
  });

  it('uses filesToTouch as files_expected when non-empty', () => {
    expect(
      contractScopeFromArchitect(
        architectScopeFixture({
          newFiles: [{ path: 'src/new.ts', layer: 'app' }],
          filesToTouch: ['README.md'],
          testFiles: ['src/new.test.ts'],
        }),
      ),
    ).toEqual({
      files_expected: ['README.md'],
      files_may_touch: ['README.md', 'src/new.ts', 'src/new.test.ts'],
    });
  });
});
