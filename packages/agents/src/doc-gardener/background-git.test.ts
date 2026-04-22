import { describe, expect, it, vi } from 'vitest';

import { isWorkingTreeClean, resolveDefaultBranch } from './background-git.js';

describe('background-git', () => {
  it('resolveDefaultBranch reads origin/HEAD symbolic ref', async () => {
    const run = vi.fn(async (args: readonly string[]) => {
      if (args[0] === 'symbolic-ref' && args[1] === 'refs/remotes/origin/HEAD') {
        return {
          stdout: 'refs/remotes/origin/develop\n',
          stderr: '',
          code: 0,
        };
      }
      return { stdout: '', stderr: '', code: 1 };
    });
    const b = await resolveDefaultBranch(run, '/r');
    expect(b).toBe('develop');
  });

  it('isWorkingTreeClean is false when porcelain has output', async () => {
    const run = vi.fn(async (args: readonly string[]) => {
      if (args[0] === 'status' && args[1] === '--porcelain') {
        return { stdout: ' M file.ts\n', stderr: '', code: 0 };
      }
      return { stdout: '', stderr: '', code: 0 };
    });
    expect(await isWorkingTreeClean(run, '/r')).toBe(false);
  });
});
