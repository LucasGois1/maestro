import { describe, expect, it } from 'vitest';

import type { TuiSensorState } from '../state/store.js';

import {
  sensorKindPrefix,
  sensorRowIsBlockFailure,
  summarizeSensors,
} from './sensorRowStyle.js';

describe('sensorRowStyle', () => {
  it('prefixes kind', () => {
    expect(sensorKindPrefix('computational')).toBe('[C]');
    expect(sensorKindPrefix('inferential')).toBe('[I]');
  });

  it('summarizes counts', () => {
    const sensors: Record<string, TuiSensorState> = {
      a: {
        sensorId: 'a',
        kind: 'computational',
        status: 'queued',
        message: null,
        durationMs: null,
        onFail: 'block',
        stdout: null,
        stderr: null,
        violations: [],
      },
      b: {
        sensorId: 'b',
        kind: 'computational',
        status: 'running',
        message: null,
        durationMs: null,
        onFail: 'block',
        stdout: null,
        stderr: null,
        violations: [],
      },
      c: {
        sensorId: 'c',
        kind: 'computational',
        status: 'passed',
        message: null,
        durationMs: 1,
        onFail: 'block',
        stdout: null,
        stderr: null,
        violations: [],
      },
    };
    expect(summarizeSensors(sensors)).toEqual({
      passed: 1,
      running: 1,
      queued: 1,
      failed: 0,
    });
  });

  it('detects block failures', () => {
    const failed: TuiSensorState = {
      sensorId: 'x',
      kind: 'computational',
      status: 'failed',
      message: null,
      durationMs: null,
      onFail: 'block',
      stdout: null,
      stderr: null,
      violations: [],
    };
    expect(sensorRowIsBlockFailure(failed)).toBe(true);
    const warned: TuiSensorState = { ...failed, onFail: 'warn' };
    expect(sensorRowIsBlockFailure(warned)).toBe(false);
  });
});
