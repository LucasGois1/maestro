import { describe, expect, it } from 'vitest';

import { parseSensorOutput } from './parsers.js';
import type { SensorParser } from './types.js';

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

  it('treats invalid ruff json as empty findings', () => {
    const result = parseSensorOutput({
      parser: 'ruff-json',
      exitCode: 1,
      stdout: 'not-json',
      stderr: '',
    });

    expect(result.violations).toEqual([]);
  });

  it('maps ruff entries without filename or location fields', () => {
    const result = parseSensorOutput({
      parser: 'ruff-json',
      exitCode: 1,
      stdout: JSON.stringify([{ code: 'E', message: 'bad' }]),
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        rule: 'E',
        message: 'bad',
        severity: 'error',
      }),
    );
    expect(result.violations[0]).not.toHaveProperty('path');
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

  it('parses mypy object reports with an errors array', () => {
    const result = parseSensorOutput({
      parser: 'mypy-json',
      exitCode: 1,
      stdout: JSON.stringify({
        errors: [
          {
            code: 'misc',
            message: 'oops',
            path: 'a.py',
            line: 1,
            severity: 'warn',
          },
        ],
      }),
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        rule: 'misc',
        path: 'a.py',
        severity: 'warn',
      }),
    );
  });

  it('falls back when mypy json is not an array or errors object', () => {
    const result = parseSensorOutput({
      parser: 'mypy-json',
      exitCode: 1,
      stdout: JSON.stringify({ note: 'x' }),
      stderr: '',
    });

    expect(result.violations).toEqual([]);
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

  it('treats pytest outcome error like failure', () => {
    const result = parseSensorOutput({
      parser: 'pytest-json',
      exitCode: 1,
      stdout: JSON.stringify({
        tests: [
          {
            nodeid: 't.py::x',
            outcome: 'error',
            call: {},
          },
        ],
      }),
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        rule: 'pytest-failure',
        path: 't.py',
      }),
    );
  });

  it('uses nodeid when pytest call details are missing', () => {
    const result = parseSensorOutput({
      parser: 'pytest-json',
      exitCode: 1,
      stdout: JSON.stringify({
        tests: [{ nodeid: 'solo.py::it', outcome: 'failed' }],
      }),
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('solo.py::it'),
      }),
    );
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

  it('uses the full tap line when there is no description separator', () => {
    const line = 'not ok 7';
    const result = parseSensorOutput({
      parser: 'tap',
      exitCode: 1,
      stdout: line,
      stderr: '',
    });

    expect(result.violations[0]).toEqual(
      expect.objectContaining({
        message: line,
      }),
    );
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

  it('ignores non-DA lcov lines and covered DA entries', () => {
    const result = parseSensorOutput({
      parser: 'lcov',
      exitCode: 0,
      stdout: ['SF:a.ts', 'FN:1,foo', 'DA:1,3', 'end_of_record'].join('\n'),
      stderr: '',
    });

    expect(result.violations).toEqual([]);
  });

  it('falls back to generic output for unexpected parser values', () => {
    const result = parseSensorOutput({
      parser: 'bogus-parser' as unknown as SensorParser,
      exitCode: 2,
      stdout: '',
      stderr: 'err',
    });

    expect(result.parsed).toEqual({ exitCode: 2 });
    expect(result.violations).toEqual([]);
  });
});
