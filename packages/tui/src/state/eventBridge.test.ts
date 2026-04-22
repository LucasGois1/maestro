import { createEventBus } from '@maestro/core';
import { describe, expect, it, vi } from 'vitest';

import { bridgeBusToStore } from './eventBridge.js';
import { createTuiStore } from './store.js';

describe('bridgeBusToStore', () => {
  describe('pipeline events', () => {
    it('transitions into run mode on pipeline.started', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'pipeline.started', runId: 'r1' });

      const state = store.getState();
      expect(state.mode).toBe('run');
      expect(state.runId).toBe('r1');
      expect(state.kbPathsRead).toEqual([]);
      expect(state.pipeline.status).toBe('running');
      expect(state.pipeline.error).toBeNull();
      expect(state.diffPreview.unifiedDiff).toBe('');
      expect(state.diffPreview.feedbackHistory).toEqual([]);
    });

    it('sets diffPreview mode from pipeline.stage_entered', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'pipeline.started', runId: 'r1' });
      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r1',
        stage: 'generating',
      });
      expect(store.getState().diffPreview.mode).toBe('diff');

      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r1',
        stage: 'evaluating',
      });
      expect(store.getState().diffPreview.mode).toBe('preview');
    });

    it('tracks stage and sprint progression', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r1',
        sprintIdx: 2,
        totalSprints: 4,
      });
      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r1',
        stage: 'generating',
        sprintIdx: 2,
      });
      bus.emit({
        type: 'pipeline.sprint_retried',
        runId: 'r1',
        sprintIdx: 2,
        retry: 1,
      });

      const state = store.getState();
      expect(state.pipeline.stage).toBe('generating');
      expect(state.pipeline.sprintIdx).toBe(2);
      expect(state.header.sprintIdx).toBe(2);
      expect(state.header.totalSprints).toBe(4);
      expect(state.pipeline.retryCount).toBe(1);
      expect(state.sprints).toEqual([
        { idx: 2, status: 'running', retries: 1 },
      ]);
    });

    it('marks sprints as escalated', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r1',
        sprintIdx: 1,
        totalSprints: 2,
      });
      bus.emit({
        type: 'pipeline.sprint_escalated',
        runId: 'r1',
        sprintIdx: 1,
        reason: 'retries exhausted',
      });

      expect(store.getState().sprints[0]?.status).toBe('escalated');
    });

    it('records plan_revised as a planner decision and log entry', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store, { clock: () => 42 });

      bus.emit({
        type: 'pipeline.plan_revised',
        runId: 'r1',
        attempt: 1,
        reasonSummary: 'Architect: narrow scope',
      });

      const { decisions, messageLog } = store.getState().agent;
      expect(decisions.some((d) => d.message.includes('Plan revised'))).toBe(
        true,
      );
      expect(
        messageLog.some(
          (e) => e.kind === 'decision' && e.text.includes('Plan revised'),
        ),
      ).toBe(true);
    });

    it('accumulates history with closed previous stages on stage_entered', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      const times = [100, 250, 400];
      let i = 0;
      bridgeBusToStore(bus, store, { clock: () => times[i++] ?? 0 });

      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r',
        stage: 'planning',
      });
      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r',
        stage: 'generating',
      });
      bus.emit({ type: 'pipeline.completed', runId: 'r', durationMs: 10 });

      const history = store.getState().pipeline.history;
      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        stage: 'planning',
        startedAt: 100,
        endedAt: 250,
      });
      expect(history[1]).toEqual({
        stage: 'generating',
        startedAt: 250,
        endedAt: 400,
      });
    });

    it('closes running sprints when a new sprint_started arrives', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 1,
        totalSprints: 2,
      });
      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 2,
        totalSprints: 2,
      });

      const sprints = store.getState().sprints;
      expect(sprints[0]).toMatchObject({ idx: 1, status: 'done' });
      expect(sprints[1]).toMatchObject({ idx: 2, status: 'running' });
    });

    it('completes all running sprints on pipeline.completed', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 1,
        totalSprints: 1,
      });
      bus.emit({ type: 'pipeline.completed', runId: 'r', durationMs: 5 });

      expect(store.getState().sprints[0]?.status).toBe('done');
    });

    it('marks the active sprint as failed on pipeline.failed', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 2,
        totalSprints: 2,
      });
      bus.emit({
        type: 'pipeline.failed',
        runId: 'r',
        error: 'kaboom',
        at: 'generating',
      });

      expect(store.getState().sprints[0]?.status).toBe('failed');
    });

    it('reflects pause, resume, completion and failure', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'pipeline.started', runId: 'r1' });
      bus.emit({
        type: 'pipeline.paused',
        runId: 'r1',
        at: 'generating',
      });
      expect(store.getState().pipeline.status).toBe('paused');

      bus.emit({
        type: 'pipeline.resumed',
        runId: 'r1',
        from: 'generating',
      });
      expect(store.getState().pipeline.status).toBe('running');

      bus.emit({ type: 'pipeline.completed', runId: 'r1', durationMs: 10 });
      expect(store.getState().pipeline.status).toBe('completed');

      bus.emit({
        type: 'pipeline.failed',
        runId: 'r1',
        error: 'boom',
        at: 'generating',
      });
      const failed = store.getState();
      expect(failed.pipeline.status).toBe('failed');
      expect(failed.pipeline.error).toBe('boom');
    });
  });

  describe('agent events', () => {
    it('records the active agent and streams deltas capped by buffer size', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store, { agentDeltaBufferChars: 6 });

      bus.emit({
        type: 'agent.started',
        agentId: 'planner',
        runId: 'r1',
      });
      bus.emit({
        type: 'agent.delta',
        agentId: 'planner',
        runId: 'r1',
        chunk: 'hello ',
      });
      bus.emit({
        type: 'agent.delta',
        agentId: 'planner',
        runId: 'r1',
        chunk: 'world',
      });

      const state = store.getState();
      expect(state.agent.activeAgentId).toBe('planner');
      expect(state.agent.lastDelta).toBe(' world');
      expect(state.agent.lastDelta.length).toBeLessThanOrEqual(6);
    });

    it('buffers decisions with a cap and uses the injected clock', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      const clock = vi.fn(() => 42);
      bridgeBusToStore(bus, store, {
        agentDecisionBufferSize: 2,
        clock,
      });

      bus.emit({
        type: 'agent.decision',
        agentId: 'planner',
        runId: 'r1',
        message: 'first',
      });
      bus.emit({
        type: 'agent.decision',
        agentId: 'planner',
        runId: 'r1',
        message: 'second',
      });
      bus.emit({
        type: 'agent.decision',
        agentId: 'planner',
        runId: 'r1',
        message: 'third',
      });

      const decisions = store.getState().agent.decisions;
      expect(decisions.map((entry) => entry.message)).toEqual([
        'second',
        'third',
      ]);
      expect(decisions.every((entry) => entry.at === 42)).toBe(true);
      expect(clock).toHaveBeenCalled();
    });

    it('appends tool_call to messageLog and ignores tool_result', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store, { clock: () => 7 });

      bus.emit({
        type: 'agent.tool_call',
        agentId: 'a',
        runId: 'r',
        tool: 'write_file',
        args: {},
      });
      bus.emit({
        type: 'agent.tool_result',
        agentId: 'a',
        runId: 'r',
        tool: 'write_file',
        result: {},
      });

      const state = store.getState();
      expect(state.agent.decisions).toEqual([]);
      expect(state.agent.messageLog).toEqual([
        { kind: 'tool_call', agentId: 'a', at: 7, text: 'write_file' },
      ]);
    });

    it('appends deltas and decisions to messageLog with buffering', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      const clockSeq = [1, 2, 3, 4, 5];
      let i = 0;
      bridgeBusToStore(bus, store, {
        agentLogBufferSize: 3,
        clock: () => clockSeq[i++] ?? 99,
      });

      bus.emit({ type: 'agent.started', agentId: 'p', runId: 'r' });
      bus.emit({ type: 'agent.delta', agentId: 'p', runId: 'r', chunk: 'a' });
      bus.emit({
        type: 'agent.decision',
        agentId: 'p',
        runId: 'r',
        message: 'go',
      });
      bus.emit({
        type: 'agent.tool_call',
        agentId: 'p',
        runId: 'r',
        tool: 't',
        args: {},
      });
      bus.emit({ type: 'agent.delta', agentId: 'p', runId: 'r', chunk: 'b' });

      const log = store.getState().agent.messageLog;
      expect(log).toHaveLength(3);
      expect(log[0]?.kind).toBe('decision');
      expect(log[1]?.kind).toBe('tool_call');
      expect(log[2]?.kind).toBe('delta');
      expect(log[2]?.text).toBe('b');
    });

    it('clears messageLog and lastDelta on agent.started', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'agent.started', agentId: 'p1', runId: 'r' });
      bus.emit({ type: 'agent.delta', agentId: 'p1', runId: 'r', chunk: 'x' });
      expect(store.getState().agent.messageLog).toHaveLength(1);

      bus.emit({ type: 'agent.started', agentId: 'p2', runId: 'r' });
      expect(store.getState().agent.messageLog).toEqual([]);
      expect(store.getState().agent.lastDelta).toBe('');
    });

    it('clears the active agent on complete and records errors on failure', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'agent.started', agentId: 'planner', runId: 'r' });
      bus.emit({
        type: 'agent.completed',
        agentId: 'planner',
        runId: 'r',
        output: null,
        durationMs: 5,
      });
      expect(store.getState().agent.activeAgentId).toBeNull();

      bus.emit({ type: 'agent.started', agentId: 'planner', runId: 'r' });
      bus.emit({
        type: 'agent.failed',
        agentId: 'planner',
        runId: 'r',
        error: 'kaboom',
      });
      expect(store.getState().agent.error).toBe('kaboom');
    });
  });

  describe('sensor events', () => {
    it('tracks sensor lifecycle from start to completion', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'sensor.started',
        sensorId: 'ruff',
        runId: 'r',
        kind: 'computational',
      });
      bus.emit({
        type: 'sensor.progress',
        sensorId: 'ruff',
        runId: 'r',
        message: 'linting…',
      });
      bus.emit({
        type: 'sensor.completed',
        sensorId: 'ruff',
        runId: 'r',
        status: 'passed',
        durationMs: 30,
      });

      const sensor = store.getState().sensors['ruff'];
      expect(sensor).toBeDefined();
      expect(sensor?.kind).toBe('computational');
      expect(sensor?.status).toBe('passed');
      expect(sensor?.message).toBe('linting…');
      expect(sensor?.durationMs).toBe(30);
      expect(sensor?.onFail).toBeNull();
    });

    it('records sensor.registered as queued with onFail', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'sensor.registered',
        sensorId: 'pytest',
        runId: 'r',
        kind: 'computational',
        onFail: 'block',
      });

      expect(store.getState().sensors['pytest']?.status).toBe('queued');
      expect(store.getState().sensors['pytest']?.onFail).toBe('block');
    });

    it('records sensor failures with error message', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'sensor.started',
        sensorId: 'mypy',
        runId: 'r',
        kind: 'computational',
      });
      bus.emit({
        type: 'sensor.failed',
        sensorId: 'mypy',
        runId: 'r',
        error: 'type error',
      });

      const sensor = store.getState().sensors['mypy'];
      expect(sensor?.status).toBe('error');
      expect(sensor?.message).toBe('type error');
    });

    it('ignores sensor.progress for unknown sensor ids', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'sensor.progress',
        sensorId: 'ghost',
        runId: 'r',
        message: 'ignored',
      });

      expect(store.getState().sensors['ghost']).toBeUndefined();
    });
  });

  describe('context events', () => {
    it('merges artifact.diff_updated into diffPreview', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'artifact.diff_updated',
        runId: 'r',
        activePath: 'src/a.ts',
        unifiedDiff: '+line',
        changedPaths: ['src/a.ts', 'src/b.ts'],
        activeIndex: 0,
      });

      const dp = store.getState().diffPreview;
      expect(dp.mode).toBe('diff');
      expect(dp.activePath).toBe('src/a.ts');
      expect(dp.unifiedDiff).toBe('+line');
      expect(dp.changedPaths).toEqual(['src/a.ts', 'src/b.ts']);
      expect(dp.diffByPath['src/a.ts']).toBe('+line');
    });

    it('appends evaluator.feedback and switches mode', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'evaluator.feedback',
        runId: 'r',
        criterion: 'security',
        failure: 'missing check',
        file: 'x.ts',
        line: 10,
        suggestedAction: 'add guard',
      });

      const dp = store.getState().diffPreview;
      expect(dp.mode).toBe('feedback');
      expect(dp.feedback?.criterion).toBe('security');
      expect(dp.feedback?.attempt).toBe(1);
      expect(dp.feedback?.sprintIdx).toBeNull();
      expect(dp.feedbackHistory).toHaveLength(1);
    });

    it('increments attempt for repeated feedback in the same sprint', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({ type: 'pipeline.started', runId: 'r' });
      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 2,
        totalSprints: 3,
      });
      bus.emit({
        type: 'evaluator.feedback',
        runId: 'r',
        criterion: 'a',
        failure: 'one',
      });
      bus.emit({
        type: 'evaluator.feedback',
        runId: 'r',
        criterion: 'b',
        failure: 'two',
      });

      const h = store.getState().diffPreview.feedbackHistory;
      expect(h).toHaveLength(2);
      expect(h[0]?.attempt).toBe(1);
      expect(h[0]?.sprintIdx).toBe(2);
      expect(h[1]?.attempt).toBe(2);
      expect(h[1]?.sprintIdx).toBe(2);
    });

    it('records kb.file_read paths for highlights', () => {
      const bus = createEventBus();
      const store = createTuiStore();
      bridgeBusToStore(bus, store);

      bus.emit({
        type: 'kb.file_read',
        runId: 'r',
        path: 'docs/a.md',
      });
      bus.emit({
        type: 'kb.file_read',
        runId: 'r',
        path: 'docs/a.md',
      });

      expect(store.getState().kbPathsRead).toEqual(['docs/a.md']);
    });
  });

  it('disposes the subscription when the returned callback is invoked', () => {
    const bus = createEventBus();
    const store = createTuiStore();
    const dispose = bridgeBusToStore(bus, store);

    dispose();
    bus.emit({ type: 'pipeline.started', runId: 'r1' });

    expect(store.getState().mode).toBe('idle');
  });
});
