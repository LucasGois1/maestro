import { describe, expect, it } from 'vitest';

import { sensorDefinitionSchema, sensorsFileSchema } from './schema.js';

describe('sensorDefinitionSchema', () => {
  it('parses computational sensors with sensible defaults', () => {
    const sensor = sensorDefinitionSchema.parse({
      id: 'ruff',
      kind: 'computational',
      command: 'ruff check .',
    });

    expect(sensor.kind).toBe('computational');
    if (sensor.kind !== 'computational') {
      throw new Error('expected computational sensor');
    }
    expect(sensor.onFail).toBe('block');
    expect(sensor.parseOutput).toBe('generic');
    expect(sensor.expectExitCode).toBe(0);
    expect(sensor.timeoutSec).toBe(60);
    expect(sensor.args).toEqual([]);
  });

  it('requires an agent for inferential sensors', () => {
    expect(() =>
      sensorDefinitionSchema.parse({
        id: 'review',
        kind: 'inferential',
      }),
    ).toThrow(/agent/i);
  });

  it('defaults inferential sensors to onFail warn', () => {
    const sensor = sensorDefinitionSchema.parse({
      id: 'review',
      kind: 'inferential',
      agent: 'code-reviewer',
    });
    expect(sensor.kind).toBe('inferential');
    if (sensor.kind !== 'inferential') {
      throw new Error('expected inferential sensor');
    }
    expect(sensor.onFail).toBe('warn');
  });

  it('rejects empty appliesTo entries', () => {
    expect(() =>
      sensorDefinitionSchema.parse({
        id: 'pytest',
        kind: 'computational',
        command: 'pnpm test',
        appliesTo: [''],
      }),
    ).toThrow(/appliesTo/i);
  });
});

describe('sensorsFileSchema', () => {
  it('defaults dispatcher concurrency to four', () => {
    const config = sensorsFileSchema.parse({
      sensors: [
        {
          id: 'pytest',
          kind: 'computational',
          command: 'pnpm test',
        },
      ],
    });

    expect(config.concurrency).toBe(4);
    expect(config.sensors).toHaveLength(1);
  });
});
