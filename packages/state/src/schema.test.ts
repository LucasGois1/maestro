import { describe, expect, it } from 'vitest';

import { runStateSchema } from './schema.js';

const valid = {
  runId: 'r1',
  version: 1,
  status: 'running',
  phase: 'planning',
  branch: 'maestro/jwt',
  worktreePath: '/tmp/repo',
  startedAt: '2026-04-20T00:00:00.000Z',
  lastUpdatedAt: '2026-04-20T00:00:00.000Z',
  metadata: {
    prompt: 'ship jwt',
    userAgent: 'maestro/0.1.0',
    providerDefaults: { planner: 'openai/gpt-5' },
  },
};

describe('runStateSchema', () => {
  it('accepts a minimal valid state', () => {
    const parsed = runStateSchema.parse(valid);
    expect(parsed.runId).toBe('r1');
    expect(parsed.status).toBe('running');
  });

  it('rejects version other than 1', () => {
    const result = runStateSchema.safeParse({ ...valid, version: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown status', () => {
    const result = runStateSchema.safeParse({ ...valid, status: 'done' });
    expect(result.success).toBe(false);
  });

  it('rejects unknown phase', () => {
    const result = runStateSchema.safeParse({ ...valid, phase: 'shipping' });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO startedAt', () => {
    const result = runStateSchema.safeParse({
      ...valid,
      startedAt: 'yesterday',
    });
    expect(result.success).toBe(false);
  });

  it('accepts failed status with failure payload and operational phase', () => {
    const parsed = runStateSchema.parse({
      ...valid,
      status: 'failed',
      phase: 'generating',
      failure: {
        message: 'provider error',
        at: 'generating',
        failedAt: '2026-04-20T00:05:00.000Z',
      },
    });
    expect(parsed.failure?.at).toBe('generating');
    expect(parsed.phase).toBe('generating');
  });

  it('normalizes legacy escalation (only reason + sprintIdx)', () => {
    const parsed = runStateSchema.parse({
      ...valid,
      status: 'paused',
      phase: 'escalated',
      escalation: {
        sprintIdx: 0,
        reason: 'Human review',
      },
    });
    expect(parsed.escalation?.source).toBe('pipeline');
    expect(parsed.escalation?.phaseAtEscalation).toBe('evaluating');
    expect(parsed.escalation?.resumeTarget).toBe('ContinueGenerate');
  });

  it('accepts full escalation with humanFeedback', () => {
    const parsed = runStateSchema.parse({
      ...valid,
      status: 'paused',
      phase: 'escalated',
      escalation: {
        sprintIdx: 1,
        reason: 'Architect: blocked',
        source: 'architect',
        phaseAtEscalation: 'architecting',
        resumeTarget: 'ReplanOnly',
        artifactHints: ['.maestro/runs/r1/contracts/sprint-2.md'],
        humanFeedback: {
          text: 'Try smaller scope',
          submittedAt: '2026-04-20T00:10:00.000Z',
        },
      },
    });
    expect(parsed.escalation?.resumeTarget).toBe('ReplanOnly');
    expect(parsed.escalation?.humanFeedback?.text).toBe('Try smaller scope');
  });
});
