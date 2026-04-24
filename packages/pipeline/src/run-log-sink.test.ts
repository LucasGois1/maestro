import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createEventBus } from '@maestro/core';
import { runLogPath } from '@maestro/state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachRunLogToEventBus } from './run-log-sink.js';

describe('attachRunLogToEventBus', () => {
  let repo: string;
  const runId = 'run-log-sink-test';

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'maestro-run-log-'));
  });

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true });
  });

  it('appends agent and stage lines to run.log.md', async () => {
    const bus = createEventBus();
    const detach = attachRunLogToEventBus({
      bus,
      repoRoot: repo,
      runId,
      maestroDir: '.maestro',
    });
    bus.emit({
      type: 'pipeline.stage_entered',
      runId,
      stage: 'planning',
    });
    bus.emit({
      type: 'agent.started',
      agentId: 'planner',
      runId,
    });
    await vi.waitFor(async () => {
      const raw = await readFile(
        runLogPath({ repoRoot: repo, runId, maestroDir: '.maestro' }),
        'utf8',
      );
      expect(raw).toContain('pipeline.stage_entered');
      expect(raw).toContain('planning');
      expect(raw).toContain('agent.started');
      expect(raw).toContain('planner');
    });
    detach();
  });

  it('preserves emit order (serialized appends)', async () => {
    const bus = createEventBus();
    const detach = attachRunLogToEventBus({
      bus,
      repoRoot: repo,
      runId,
      maestroDir: '.maestro',
    });
    bus.emit({
      type: 'pipeline.stage_entered',
      runId,
      stage: 'evaluating',
      sprintIdx: 0,
    });
    bus.emit({
      type: 'agent.completed',
      agentId: 'generator',
      runId,
      durationMs: 100,
      output: { filesChanged: ['a'], commits: [] },
    });
    bus.emit({
      type: 'agent.started',
      agentId: 'evaluator',
      runId,
    });
    await vi.waitFor(async () => {
      const raw = await readFile(
        runLogPath({ repoRoot: repo, runId, maestroDir: '.maestro' }),
        'utf8',
      );
      const stageIdx = raw.indexOf('pipeline.stage_entered');
      const genIdx = raw.indexOf('agent.completed');
      const evIdx = raw.indexOf('agent.started');
      expect(stageIdx).toBeGreaterThanOrEqual(0);
      expect(genIdx).toBeGreaterThan(stageIdx);
      expect(evIdx).toBeGreaterThan(genIdx);
      expect(raw).toContain('evaluating sprintIdx=0');
      expect(raw).toContain('filesChanged=1 commits=0');
    });
    detach();
  });

  it('logs tool_result and evaluator summary on agent.completed', async () => {
    const bus = createEventBus();
    const detach = attachRunLogToEventBus({
      bus,
      repoRoot: repo,
      runId,
      maestroDir: '.maestro',
    });
    bus.emit({
      type: 'agent.tool_call',
      agentId: 'evaluator',
      runId,
      tool: 'readFile',
      args: { path: 'x.md' },
    });
    bus.emit({
      type: 'agent.tool_result',
      agentId: 'evaluator',
      runId,
      tool: 'readFile',
      result: { ok: true, path: 'x.md' },
    });
    bus.emit({
      type: 'agent.completed',
      agentId: 'evaluator',
      runId,
      durationMs: 50,
      output: {
        decision: 'pass',
        sensorsRun: [{ id: 'lint', ok: true }],
        suggestedActions: [],
        structuredFeedback: 'All criteria met.\nSecond line.',
      },
    });
    await vi.waitFor(async () => {
      const raw = await readFile(
        runLogPath({ repoRoot: repo, runId, maestroDir: '.maestro' }),
        'utf8',
      );
      expect(raw).toContain('agent.tool_call');
      expect(raw).toContain('readFile');
      expect(raw).toContain('agent.tool_result');
      expect(raw).toContain('ok=true');
      expect(raw).toContain('decision=pass');
      expect(raw).toContain('sensorsRun=1 (ok 1)');
      expect(raw).toContain('sensorIds=lint');
      expect(raw).toContain('feedbackHead=All criteria met.');
    });
    detach();
  });

  it('ignores events for other runIds', async () => {
    const bus = createEventBus();
    const detach = attachRunLogToEventBus({
      bus,
      repoRoot: repo,
      runId,
      maestroDir: '.maestro',
    });
    bus.emit({
      type: 'agent.started',
      agentId: 'generator',
      runId: 'other-run',
    });
    await new Promise((r) => setTimeout(r, 30));
    detach();
    await expect(
      readFile(
        runLogPath({ repoRoot: repo, runId, maestroDir: '.maestro' }),
        'utf8',
      ),
    ).rejects.toThrow();
  });
});
