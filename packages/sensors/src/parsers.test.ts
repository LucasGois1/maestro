import { describe, expect, it } from 'vitest';

import { parseSensorOutput } from './parsers.js';

describe('parseSensorOutput', () => {
  it('parses generic output without violations', () => {
    const result = parseSensorOutput({
      parser: 'generic',
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    });

    expect(result.violations).toEqual([]);
    expect(result.parsed).toEqual({ exitCode: 0 });
  });

  it('parses ruff json findings', () => {
    const result = parseSensorOutput({
      parser: 'ruff-json',
      exitCode: 1,
      stdout: JSON.stringify([
        {
          code: 'F401',
          message: '`os` imported but unused',
          filename: 'app.py',
          location: { row: 3, column: 1 },
        },
      ]),
      stderr: '',
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        rule: 'F401',
        path: 'app.py',
        line: 3,
        column: 1,
        severity: 'error',
      }),
    ]);
  });

  it('parses mypy json findings', () => {
    const result = parseSensorOutput({
      parser: 'mypy-json',
      exitCode: 1,
      stdout: JSON.stringify([
        {
          code: 'arg-type',
          message: 'Argument 1 has incompatible type',
          path: 'src/main.py',
          line: 7,
          column: 2,
          severity: 'error',
        },
      ]),
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        rule: 'arg-type',
        path: 'src/main.py',
        line: 7,
      }),
    );
  });

  it('parses pytest json report failures', () => {
    const result = parseSensorOutput({
      parser: 'pytest-json',
      exitCode: 1,
      stdout: JSON.stringify({
        tests: [
          {
            nodeid: 'tests/test_auth.py::test_login',
            outcome: 'failed',
            call: {
              longrepr: 'AssertionError: expected 200',
            },
          },
        ],
      }),
      stderr: '',
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        rule: 'pytest-failure',
        path: 'tests/test_auth.py',
        source: 'tests/test_auth.py::test_login',
      }),
    ]);
  });

  it('parses tap failures', () => {
    const result = parseSensorOutput({
      parser: 'tap',
      exitCode: 1,
      stdout: ['TAP version 13', 'not ok 2 - handles retries'].join('\n'),
      stderr: '',
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        rule: 'tap-failure',
        message: 'handles retries',
        line: 2,
      }),
    ]);
  });

  it('parses uncovered lcov lines', () => {
    const result = parseSensorOutput({
      parser: 'lcov',
      exitCode: 0,
      stdout: [
        'TN:',
        'SF:packages/sensors/src/index.ts',
        'DA:12,0',
        'DA:13,1',
        'end_of_record',
      ].join('\n'),
      stderr: '',
    });

    expect(result.violations).toEqual([
      expect.objectContaining({
        rule: 'lcov-uncovered-line',
        path: 'packages/sensors/src/index.ts',
        line: 12,
      }),
    ]);
  });
});
