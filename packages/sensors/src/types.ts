export const SENSOR_KINDS = ['computational', 'inferential'] as const;
export type SensorKind = (typeof SENSOR_KINDS)[number];

export const SENSOR_ON_FAIL = ['block', 'warn'] as const;
export type SensorOnFail = (typeof SENSOR_ON_FAIL)[number];

export const SENSOR_PARSERS = [
  'generic',
  'ruff-json',
  'mypy-json',
  'pytest-json',
  'tap',
  'lcov',
] as const;
export type SensorParser = (typeof SENSOR_PARSERS)[number];

export const SENSOR_STATUSES = [
  'passed',
  'failed',
  'warned',
  'skipped',
  'timeout',
  'error',
] as const;
export type SensorStatus = (typeof SENSOR_STATUSES)[number];

export const VIOLATION_SEVERITIES = ['info', 'warn', 'error'] as const;
export type ViolationSeverity = (typeof VIOLATION_SEVERITIES)[number];

export type Violation = {
  readonly rule: string;
  readonly message: string;
  readonly severity: ViolationSeverity;
  readonly path?: string;
  readonly line?: number;
  readonly column?: number;
  readonly source?: string;
  /** Categoria semântica (ex.: code review inferencial). */
  readonly category?: string;
  readonly suggestion?: string;
};

export type SensorResult = {
  readonly sensorId: string;
  readonly status: SensorStatus;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly parsed?: unknown;
  readonly violations: readonly Violation[];
};
