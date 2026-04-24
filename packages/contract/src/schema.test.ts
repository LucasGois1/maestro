import { describe, expect, it } from 'vitest';

import { sprintContractFrontmatterSchema } from './schema.js';

const valid = {
  sprint: 1,
  feature: 'Session bootstrap',
  status: 'proposed' as const,
  acceptance_criteria: [
    {
      id: 'session_create',
      description: 'Creates a session',
      verifier: 'pytest tests/test_session.py',
    },
  ],
};

describe('sprintContractFrontmatterSchema', () => {
  it('applies defaults for optional collections', () => {
    const parsed = sprintContractFrontmatterSchema.parse(valid);
    expect(parsed.depends_on).toEqual([]);
    expect(parsed.scope.files_expected).toEqual([]);
    expect(parsed.iterations).toBe(0);
    expect(parsed.negotiated_by).toEqual([]);
  });

  it('rejects unknown root keys', () => {
    const parsed = sprintContractFrontmatterSchema.safeParse({
      ...valid,
      rogue: true,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects empty acceptance criteria', () => {
    const parsed = sprintContractFrontmatterSchema.safeParse({
      ...valid,
      acceptance_criteria: [],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects negative sprint numbers', () => {
    const parsed = sprintContractFrontmatterSchema.safeParse({
      ...valid,
      sprint: 0,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown status', () => {
    const parsed = sprintContractFrontmatterSchema.safeParse({
      ...valid,
      status: 'shipped',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects unknown negotiated_by role', () => {
    const parsed = sprintContractFrontmatterSchema.safeParse({
      ...valid,
      negotiated_by: ['intruder'],
    });
    expect(parsed.success).toBe(false);
  });
});
