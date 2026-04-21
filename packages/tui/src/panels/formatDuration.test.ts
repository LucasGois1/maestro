import { describe, expect, it } from 'vitest';

import { formatDurationMs } from './formatDuration.js';

describe('formatDurationMs', () => {
  it('returns em-dash for null or invalid durations', () => {
    expect(formatDurationMs(null)).toBe('—');
    expect(formatDurationMs(-1)).toBe('—');
    expect(formatDurationMs(Number.NaN)).toBe('—');
    expect(formatDurationMs(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formats sub-second durations as milliseconds', () => {
    expect(formatDurationMs(0)).toBe('0ms');
    expect(formatDurationMs(250)).toBe('250ms');
    expect(formatDurationMs(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDurationMs(1_000)).toBe('1s');
    expect(formatDurationMs(45_000)).toBe('45s');
    expect(formatDurationMs(59_499)).toBe('59s');
  });

  it('formats minutes with optional seconds', () => {
    expect(formatDurationMs(60_000)).toBe('1m');
    expect(formatDurationMs(80_000)).toBe('1m 20s');
    expect(formatDurationMs(3_540_000)).toBe('59m');
  });

  it('formats hours with optional minutes', () => {
    expect(formatDurationMs(3_600_000)).toBe('1h');
    expect(formatDurationMs(7_800_000)).toBe('2h 10m');
  });
});
