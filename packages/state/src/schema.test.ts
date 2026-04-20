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
});
