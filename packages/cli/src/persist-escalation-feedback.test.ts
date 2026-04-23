import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from '@maestro/core';
import { createStateStore } from '@maestro/state';
import { createTuiStore } from '@maestro/tui';

import { createPersistEscalationHumanFeedback } from './persist-escalation-feedback.js';

describe('createPersistEscalationHumanFeedback', () => {
  it('calls resumePipeline after persisting when resumeAfterPersist is set', async () => {
    const repoRoot = '/tmp/maestro-persist-test';
    const bus = createEventBus();
    const stateStore = createStateStore({ repoRoot });
    const tuiStore = createTuiStore({ colorMode: 'no-color' });
    const runId = 'run-escalation-1';

    await stateStore.create({
      runId,
      branch: 'b',
      worktreePath: repoRoot,
      prompt: 'p',
      userAgent: 'test',
      providerDefaults: {},
    });
    await stateStore.update(runId, {
      status: 'paused',
      phase: 'escalated',
      escalation: {
        reason: 'need human',
        sprintIdx: 0,
        source: 'evaluator',
        phaseAtEscalation: 'evaluating',
        resumeTarget: 'ContinueGenerate',
      },
    });

    tuiStore.setState((s) => ({
      ...s,
      runId,
      mode: 'run',
    }));

    const resumePipelineFn = vi.fn().mockResolvedValue(undefined);
    const loadConfig = vi.fn().mockResolvedValue({
      resolved: { branching: { strategy: 'runId' as const, prefix: 'm/' } },
    });

    const persist = createPersistEscalationHumanFeedback({
      stateStore,
      tuiStore,
      resumeAfterPersist: {
        repoRoot,
        bus,
        loadConfig: loadConfig as never,
      },
      resumePipelineFn: resumePipelineFn as never,
    });

    const result = await persist('please fix the contract');

    expect(result.ok).toBe(true);
    expect(result.message).toContain('retomar');

    const loaded = await stateStore.load(runId);
    expect(loaded?.escalation?.humanFeedback?.text).toBe(
      'please fix the contract',
    );

    expect(loadConfig).toHaveBeenCalledWith({ cwd: repoRoot });
    expect(resumePipelineFn).toHaveBeenCalledWith(
      expect.objectContaining({
        runId,
        repoRoot,
        store: stateStore,
        bus,
      }),
    );
  });

  it('does not call resume when resumeAfterPersist is omitted', async () => {
    const repoRoot = '/tmp/maestro-persist-test-2';
    const stateStore = createStateStore({ repoRoot });
    const tuiStore = createTuiStore({ colorMode: 'no-color' });
    const runId = 'run-2';

    await stateStore.create({
      runId,
      branch: 'b',
      worktreePath: repoRoot,
      prompt: 'p',
      userAgent: 'test',
      providerDefaults: {},
    });
    await stateStore.update(runId, {
      status: 'paused',
      phase: 'escalated',
      escalation: {
        reason: 'r',
        sprintIdx: 0,
        source: 'evaluator',
        phaseAtEscalation: 'evaluating',
        resumeTarget: 'ReplanOnly',
      },
    });
    tuiStore.setState((s) => ({ ...s, runId }));

    const resumePipelineFn = vi.fn();
    const persist = createPersistEscalationHumanFeedback({
      stateStore,
      tuiStore,
      resumePipelineFn: resumePipelineFn as never,
    });

    const result = await persist('note');

    expect(result.ok).toBe(true);
    expect(resumePipelineFn).not.toHaveBeenCalled();
  });
});
