import { describe, expect, it } from 'vitest';

import { contractFileName, resolveContractPath } from './paths.js';

describe('resolveContractPath', () => {
  it('builds the canonical .maestro path', () => {
    const path = resolveContractPath({
      repoRoot: '/tmp/repo',
      runId: 'abc123',
      sprint: 2,
    });
    expect(path).toBe('/tmp/repo/.maestro/runs/abc123/contracts/sprint-2.md');
  });

  it('honours a custom maestroDir', () => {
    const path = resolveContractPath({
      repoRoot: '/tmp/repo',
      runId: 'abc',
      sprint: 1,
      maestroDir: '.orchestrator',
    });
    expect(path).toBe('/tmp/repo/.orchestrator/runs/abc/contracts/sprint-1.md');
  });
});

describe('contractFileName', () => {
  it('formats sprint-<n>.md', () => {
    expect(contractFileName(7)).toBe('sprint-7.md');
  });
});
