import type { SensorParser, Violation, ViolationSeverity } from './types.js';

export type ParseSensorOutputOptions = {
  readonly parser: SensorParser;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type ParsedSensorOutput = {
  readonly parsed: unknown;
  readonly violations: readonly Violation[];
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toSeverity(
  input: unknown,
  fallback: ViolationSeverity,
): ViolationSeverity {
  return input === 'info' || input === 'warn' || input === 'error'
    ? input
    : fallback;
}

function parseRuffJson(stdout: string): ParsedSensorOutput {
  const parsed = parseJson(stdout);
  const entries = Array.isArray(parsed) ? parsed : [];
  const violations = entries.map((entry) => {
    const record = entry as Record<string, unknown>;
    const location =
      typeof record.location === 'object' && record.location !== null
        ? (record.location as Record<string, unknown>)
        : {};

    return {
      rule: String(record.code ?? 'ruff'),
      message: String(record.message ?? 'ruff violation'),
      severity: 'error' as const,
      ...(record.filename !== undefined
        ? { path: String(record.filename) }
        : {}),
      ...(location.row !== undefined ? { line: Number(location.row) } : {}),
      ...(location.column !== undefined
        ? { column: Number(location.column) }
        : {}),
    };
  });

  return { parsed, violations };
}

function parseMypyJson(stdout: string): ParsedSensorOutput {
  const parsed = parseJson(stdout);
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { errors?: unknown[] }).errors)
      ? (parsed as { errors: unknown[] }).errors
      : [];

  const violations = entries.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      rule: String(record.code ?? 'mypy'),
      message: String(record.message ?? 'mypy error'),
      severity: toSeverity(record.severity, 'error'),
      ...(record.path !== undefined ? { path: String(record.path) } : {}),
      ...(record.line !== undefined ? { line: Number(record.line) } : {}),
      ...(record.column !== undefined ? { column: Number(record.column) } : {}),
    };
  });

  return { parsed, violations };
}

function parsePytestJson(stdout: string): ParsedSensorOutput {
  const parsed = parseJson(stdout);
  const tests =
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { tests?: unknown[] }).tests)
      ? (parsed as { tests: unknown[] }).tests
      : [];

  const violations = tests
    .map((entry) => entry as Record<string, unknown>)
    .filter((entry) => entry.outcome === 'failed' || entry.outcome === 'error')
    .map((entry) => {
      const nodeid = String(entry.nodeid ?? 'unknown');
      const [path] = nodeid.split('::');
      const call =
        typeof entry.call === 'object' && entry.call !== null
          ? (entry.call as Record<string, unknown>)
          : {};

      return {
        rule: 'pytest-failure',
        message: String(call.longrepr ?? `${nodeid} failed`),
        severity: 'error' as const,
        ...(path !== undefined ? { path } : {}),
        source: nodeid,
      };
    });

  return { parsed, violations };
}

function parseTap(stdout: string): ParsedSensorOutput {
  const violations = stdout
    .split('\n')
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith('not ok '))
    .map(({ line, index }) => {
      const parts = line.split(' - ');
      return {
        rule: 'tap-failure',
        message: parts[1] ?? line,
        severity: 'error' as const,
        line: index + 1,
      };
    });

  return { parsed: { format: 'tap' }, violations };
}

function parseLcov(stdout: string): ParsedSensorOutput {
  let currentPath: string | undefined;
  const violations: Violation[] = [];

  for (const rawLine of stdout.split('\n')) {
    if (rawLine.startsWith('SF:')) {
      currentPath = rawLine.slice(3).trim();
      continue;
    }
    if (!rawLine.startsWith('DA:')) {
      continue;
    }
    const [lineNo, count] = rawLine.slice(3).split(',');
    if (Number(count) !== 0) {
      continue;
    }

    violations.push({
      rule: 'lcov-uncovered-line',
      message: 'Line is not covered by tests',
      severity: 'warn',
      ...(currentPath !== undefined ? { path: currentPath } : {}),
      line: Number(lineNo),
    });
  }

  return { parsed: { format: 'lcov' }, violations };
}

export function parseSensorOutput(
  options: ParseSensorOutputOptions,
): ParsedSensorOutput {
  switch (options.parser) {
    case 'ruff-json':
      return parseRuffJson(options.stdout);
    case 'mypy-json':
      return parseMypyJson(options.stdout);
    case 'pytest-json':
      return parsePytestJson(options.stdout);
    case 'tap':
      return parseTap(options.stdout);
    case 'lcov':
      return parseLcov(options.stdout);
    case 'generic':
    default:
      return {
        parsed: { exitCode: options.exitCode },
        violations: [],
      };
  }
}
