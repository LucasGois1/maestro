import { describe, expect, it, vi } from 'vitest';

import { mergeOpenPrDeps, openPrForCategory } from './open-pr-category.js';

describe('openPrForCategory', () => {
  it('invokes executePr with gh args containing maestro, background, and doc-fix labels', async () => {
    const captured: { program: string; args: readonly string[] }[] = [];
    const deps = mergeOpenPrDeps({
      detectRemote: vi.fn(async () => ({
        name: 'origin',
        url: 'git@github.com:acme/repo.git',
        platform: 'github' as const,
      })),
      runGit: vi.fn(async (args: readonly string[]) => {
        if (args[0] === 'symbolic-ref') {
          return {
            stdout: 'refs/remotes/origin/main\n',
            stderr: '',
            code: 0,
          };
        }
        if (args[0] === 'checkout' && args[1] !== '-b') {
          return { stdout: '', stderr: '', code: 0 };
        }
        if (args[0] === 'checkout' && args[1] === '-b') {
          return { stdout: '', stderr: '', code: 0 };
        }
        if (args[0] === 'commit') return { stdout: '', stderr: '', code: 0 };
        if (args[0] === 'push') return { stdout: '', stderr: '', code: 0 };
        return { stdout: '', stderr: '', code: 0 };
      }),
      executePr: vi.fn(async ({ command }) => {
        captured.push({ program: command.program, args: command.args });
        return { stdout: 'https://github.com/acme/repo/pull/42\n', code: 0 };
      }),
    });

    const pr = await openPrForCategory(
      '/repo',
      'doc-fix',
      'Doc hygiene',
      'Body',
      deps,
    );

    expect(pr?.url).toBe('https://github.com/acme/repo/pull/42');
    expect(deps.executePr).toHaveBeenCalledOnce();
    expect(captured[0]?.program).toBe('gh');
    const flat = captured[0]?.args.join('\0') ?? '';
    expect(flat).toContain('maestro');
    expect(flat).toContain('background');
    expect(flat).toContain('doc-fix');
    expect(flat).toContain('--base');
    expect(flat).toContain('main');
  });

  it('uses code-cleanup label for code category', async () => {
    const captured: { args: readonly string[] }[] = [];
    const deps = mergeOpenPrDeps({
      detectRemote: vi.fn(async () => ({
        name: 'origin',
        url: 'git@github.com:acme/repo.git',
        platform: 'github' as const,
      })),
      runGit: vi.fn(async (args: readonly string[]) => {
        if (args[0] === 'symbolic-ref') {
          return {
            stdout: 'refs/remotes/origin/main\n',
            stderr: '',
            code: 0,
          };
        }
        if (args[0] === 'checkout' && args[1] !== '-b') {
          return { stdout: '', stderr: '', code: 0 };
        }
        if (args[0] === 'checkout' && args[1] === '-b') {
          return { stdout: '', stderr: '', code: 0 };
        }
        if (args[0] === 'commit') return { stdout: '', stderr: '', code: 0 };
        if (args[0] === 'push') return { stdout: '', stderr: '', code: 0 };
        return { stdout: '', stderr: '', code: 0 };
      }),
      executePr: vi.fn(async ({ command }) => {
        captured.push({ args: command.args });
        return { stdout: 'https://github.com/acme/repo/pull/43\n', code: 0 };
      }),
    });

    await openPrForCategory(
      '/repo',
      'code-cleanup',
      'Code drift',
      'Body',
      deps,
    );

    const flat = captured[0]?.args.join('\0') ?? '';
    expect(flat).toContain('code-cleanup');
  });
});
