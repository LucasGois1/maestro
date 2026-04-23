import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  AgentExecutor,
  EvaluatorModelOutput,
  MergerModelOutput,
} from '@maestro/pipeline';
import {
  PipelineEscalationError,
  PipelinePauseError,
  resumePipeline,
  runPipeline,
} from '@maestro/pipeline';
import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createRunFixture } from '@maestro/testkit';
import { describe, expect, it } from 'vitest';

type RunFixtureJson = {
  readonly id: string;
  readonly prompt: string;
  readonly sprints?: number;
  readonly retries?: number;
};

const fixturesDir = join(process.cwd(), 'tests', 'fixtures', 'runs');

async function loadRunFixture(id: string): Promise<RunFixtureJson> {
  return JSON.parse(
    await readFile(join(fixturesDir, `${id}.json`), 'utf8'),
  ) as RunFixtureJson;
}

function plannerOutput(sprints = 2) {
  return {
    feature: 'Testing Harness',
    overview: 'Exercise the deterministic test pipeline.',
    userStories: [
      {
        id: 1,
        role: 'maintainer',
        action: 'run tests',
        value: 'trust changes',
      },
    ],
    aiFeatures: [],
    sprints: Array.from({ length: sprints }, (_, idx) => ({
      idx: idx + 1,
      name: `Sprint ${idx + 1}`,
      objective: `Implement slice ${idx + 1}`,
      userStoryIds: [1],
      dependsOn: idx === 0 ? [] : [idx],
      complexity: 'low',
      keyFeatures: [`slice-${idx + 1}`],
    })),
  };
}

function architectOk(input: unknown) {
  const sprint = (input as { sprint: { idx: number } }).sprint;
  return {
    sprintIdx: sprint.idx,
    scopeTecnico: { newFiles: [], filesToTouch: [], testFiles: [] },
    patternsToFollow: ['Keep deterministic fixtures small.'],
    libraries: [],
    boundaryCheck: 'ok',
    boundaryNotes: null,
    escalation: null,
  };
}

function generatorOk(input: unknown) {
  const sprint = (input as { sprint: { idx: number } }).sprint;
  return {
    sprintIdx: sprint.idx,
    filesChanged: [{ path: `slice-${sprint.idx}.ts`, changeType: 'added' }],
    commits: [
      { sha: `c0ffee${sprint.idx}`, message: 'test(fixtures): add slice' },
    ],
    selfEval: { coversAllCriteria: true, missingCriteria: [], concerns: [] },
    handoffNotes: `Completed slice ${sprint.idx}.`,
  };
}

function evaluatorPassed(): EvaluatorModelOutput {
  return {
    decision: 'passed',
    structuredFeedback: '## Summary\nFixture accepted.',
    coverage: null,
    sensorsRun: [],
    artifacts: [],
    suggestedActions: [],
  };
}

function mergerOk(branch: string): MergerModelOutput {
  return {
    runStatus: 'completed',
    branch,
    commitCount: 1,
    execPlanPath: '.maestro/docs/exec-plans/completed/placeholder.md',
    cleanupDone: false,
    prUrl: null,
    prNumber: null,
    summary: 'Fixture packaged.',
    prTitle: null,
  };
}

function executorFor(
  handlers: Partial<Record<string, (input: unknown) => unknown>>,
): AgentExecutor {
  return async ({ definition, input }) => {
    const handler = handlers[definition.id];
    if (!handler) throw new Error(`No fixture handler for ${definition.id}`);
    return handler(input) as never;
  };
}

describe('DSFT-97 integration fixtures with mocked LLMs', () => {
  it('keeps the required run fixtures committed', async () => {
    const ids = [
      'happy-path',
      'eval-rejects-3x',
      'compaction-trigger',
      'sensor-timeout',
      'permission-denied',
      'resume-after-pause',
    ];
    await expect(Promise.all(ids.map(loadRunFixture))).resolves.toHaveLength(6);
  });

  it('runs the happy path end-to-end with deterministic agent outputs', async () => {
    const spec = await loadRunFixture('happy-path');
    const fixture = await createRunFixture({
      runId: spec.id,
      prompt: spec.prompt,
    });
    try {
      const result = await runPipeline({
        runId: fixture.runId,
        prompt: fixture.prompt,
        branch: fixture.branch,
        worktreePath: fixture.repoRoot,
        repoRoot: fixture.repoRoot,
        store: fixture.store,
        bus: fixture.bus,
        config: fixture.config,
        executor: executorFor({
          planner: () => plannerOutput(spec.sprints),
          architect: architectOk,
          generator: generatorOk,
          evaluator: evaluatorPassed,
          merger: () => mergerOk(fixture.branch),
        }),
      });

      expect(result.state.status).toBe('completed');
      expect(result.sprintOutcomes).toHaveLength(spec.sprints ?? 2);
      await expect(
        readFile(
          join(
            fixture.repoRoot,
            '.maestro',
            'runs',
            fixture.runId,
            'checkpoints',
            'sprint-1-handoff.md',
          ),
          'utf8',
        ),
      ).resolves.toContain('Completed slice 1.');
    } finally {
      await fixture.cleanup();
    }
  });

  it('escalates after three evaluator rejections', async () => {
    const spec = await loadRunFixture('eval-rejects-3x');
    const fixture = await createRunFixture({
      runId: spec.id,
      prompt: spec.prompt,
    });
    let attempts = 0;
    try {
      await expect(
        runPipeline({
          runId: fixture.runId,
          prompt: fixture.prompt,
          branch: fixture.branch,
          worktreePath: fixture.repoRoot,
          repoRoot: fixture.repoRoot,
          store: fixture.store,
          bus: fixture.bus,
          config: fixture.config,
          retries: spec.retries,
          executor: executorFor({
            planner: () => plannerOutput(1),
            architect: architectOk,
            generator: (input) => {
              attempts += 1;
              return generatorOk(input);
            },
            evaluator: () => ({
              decision: 'failed',
              structuredFeedback: '## Summary\nStill missing acceptance.',
              sensorsRun: [],
              artifacts: [],
              suggestedActions: ['Fix the missing acceptance path.'],
            }),
            merger: () => mergerOk(fixture.branch),
          }),
        }),
      ).rejects.toBeInstanceOf(PipelineEscalationError);

      const state = await fixture.store.load(fixture.runId);
      expect(attempts).toBe(3);
      expect(state?.status).toBe('paused');
      expect(state?.phase).toBe('escalated');
    } finally {
      await fixture.cleanup();
    }
  });

  it('resumes a paused run with a fresh mocked executor', async () => {
    const spec = await loadRunFixture('resume-after-pause');
    const fixture = await createRunFixture({
      runId: spec.id,
      prompt: spec.prompt,
    });
    const controller = new AbortController();
    try {
      await expect(
        runPipeline({
          runId: fixture.runId,
          prompt: fixture.prompt,
          branch: fixture.branch,
          worktreePath: fixture.repoRoot,
          repoRoot: fixture.repoRoot,
          store: fixture.store,
          bus: fixture.bus,
          config: fixture.config,
          abortSignal: controller.signal,
          executor: executorFor({
            planner: () => plannerOutput(1),
            architect: (input) => {
              controller.abort();
              return architectOk(input);
            },
            generator: generatorOk,
            evaluator: evaluatorPassed,
            merger: () => mergerOk(fixture.branch),
          }),
        }),
      ).rejects.toBeInstanceOf(PipelinePauseError);

      const events: MaestroEvent[] = [];
      const resumeBus = createEventBus();
      resumeBus.on((event) => events.push(event));
      const result = await resumePipeline({
        repoRoot: fixture.repoRoot,
        store: fixture.store,
        bus: resumeBus,
        config: fixture.config,
        executor: executorFor({
          planner: () => plannerOutput(1),
          architect: architectOk,
          generator: generatorOk,
          evaluator: evaluatorPassed,
          merger: () => mergerOk(fixture.branch),
        }),
      });

      expect(result.state.status).toBe('completed');
      expect(events.some((event) => event.type === 'pipeline.resumed')).toBe(
        true,
      );
    } finally {
      await fixture.cleanup();
    }
  });
});
