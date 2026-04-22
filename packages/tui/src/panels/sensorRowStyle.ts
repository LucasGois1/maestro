import type { TuiSensorState } from '../state/store.js';

import { formatDurationMs } from './formatDuration.js';

export function sensorKindPrefix(kind: TuiSensorState['kind']): string {
  return kind === 'computational' ? '[C]' : '[I]';
}

export function sensorStatusLabel(status: TuiSensorState['status']): string {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'running…';
    case 'passed':
      return 'passed';
    case 'warned':
      return 'warned';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    case 'timeout':
      return 'timeout';
    case 'error':
      return 'error';
  }
}

export function summarizeSensors(
  sensors: Readonly<Record<string, TuiSensorState>>,
): {
  readonly passed: number;
  readonly running: number;
  readonly queued: number;
  readonly failed: number;
} {
  const list = Object.values(sensors);
  let passed = 0;
  let running = 0;
  let queued = 0;
  let failed = 0;
  for (const s of list) {
    if (s.status === 'queued') {
      queued += 1;
    } else if (s.status === 'running') {
      running += 1;
    } else if (
      s.status === 'passed' ||
      s.status === 'warned' ||
      s.status === 'skipped'
    ) {
      passed += 1;
    } else if (
      s.status === 'failed' ||
      s.status === 'error' ||
      s.status === 'timeout'
    ) {
      failed += 1;
    }
  }
  return { passed, running, queued, failed };
}

export function formatSensorRow(
  sensor: TuiSensorState,
  maxMessageLen: number,
): string {
  const prefix = sensorKindPrefix(sensor.kind);
  const status = sensorStatusLabel(sensor.status);
  const dur =
    sensor.durationMs !== null
      ? ` (${formatDurationMs(sensor.durationMs)})`
      : '';
  const msg = sensor.message
    ? ` · ${sensor.message.length > maxMessageLen ? `${sensor.message.slice(0, maxMessageLen)}…` : sensor.message}`
    : '';
  return `${prefix} ${sensor.sensorId.padEnd(14, ' ')} ${status}${dur}${msg}`;
}

export function sensorRowIsBlockFailure(sensor: TuiSensorState): boolean {
  if (sensor.onFail !== 'block') {
    return false;
  }
  return (
    sensor.status === 'failed' ||
    sensor.status === 'error' ||
    sensor.status === 'timeout'
  );
}
