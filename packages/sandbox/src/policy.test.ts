import { describe, expect, it } from 'vitest';

import { checkCommand, composePolicy } from './policy.js';

function policy(
  mode: 'strict' | 'allowlist' | 'yolo',
  allow: string[] = [],
  deny: string[] = [],
) {
  return composePolicy({ mode, allowlist: allow, denylist: deny });
}

describe('checkCommand', () => {
  it('blocks denylisted commands in every mode', () => {
    const dangerous = { cmd: 'rm', args: ['-rf', '/'] };
    for (const mode of ['strict', 'allowlist', 'yolo'] as const) {
      const decision = checkCommand({
        ...dangerous,
        policy: policy(mode),
      });
      expect(decision.kind).toBe('deny');
    }
  });

  it('allowlist mode approves known commands automatically', () => {
    const decision = checkCommand({
      cmd: 'pytest',
      args: ['tests/'],
      policy: policy('allowlist'),
    });
    expect(decision.kind).toBe('allow');
    if (decision.kind === 'allow') expect(decision.reason).toBe('allowlist');
  });

  it('allowlist mode asks for unknown commands', () => {
    const decision = checkCommand({
      cmd: 'rm',
      args: ['file.txt'],
      policy: policy('allowlist'),
    });
    expect(decision.kind).toBe('ask');
  });

  it('strict mode always asks, even for allowlisted commands', () => {
    const decision = checkCommand({
      cmd: 'pytest',
      args: [],
      policy: policy('strict'),
    });
    expect(decision.kind).toBe('ask');
  });

  it('yolo mode approves everything that survives the denylist', () => {
    const decision = checkCommand({
      cmd: 'curl',
      args: ['example.com'],
      policy: policy('yolo'),
    });
    expect(decision.kind).toBe('allow');
    if (decision.kind === 'allow') expect(decision.reason).toBe('yolo');
  });

  it('honours user-supplied allowlist extensions', () => {
    const decision = checkCommand({
      cmd: 'deploy.sh',
      args: ['staging'],
      policy: composePolicy({
        mode: 'allowlist',
        allowlist: ['deploy.sh *'],
      }),
    });
    expect(decision.kind).toBe('allow');
  });
});
