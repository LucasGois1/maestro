import { describe, expect, it } from 'vitest';

import {
  appendAudit,
  checkCommand,
  compilePattern,
  composePolicy,
  runShellCommand,
  SANDBOX_PACKAGE_NAME,
} from './index.js';

describe('@maestro/sandbox exports', () => {
  it('exposes sandbox policy, audit, and runner helpers', () => {
    expect(SANDBOX_PACKAGE_NAME).toBe('@maestro/sandbox');
    expect(typeof appendAudit).toBe('function');
    expect(typeof checkCommand).toBe('function');
    expect(typeof compilePattern).toBe('function');
    expect(typeof composePolicy).toBe('function');
    expect(typeof runShellCommand).toBe('function');
  });
});
