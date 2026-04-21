import { createEventBus, type MaestroEvent } from '@maestro/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEMO_SCRIPT, playDemoEvents } from './demo-events.js';

describe('playDemoEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits the default script deterministically', () => {
    const bus = createEventBus();
    const events: MaestroEvent[] = [];
    bus.on((event) => events.push(event));

    const handle = playDemoEvents(bus);
    vi.advanceTimersByTime(handle.totalDurationMs);

    expect(events).toHaveLength(DEMO_SCRIPT.length);
    expect(events[0]?.type).toBe('pipeline.started');
    expect(events[events.length - 1]?.type).toBe('pipeline.completed');
  });

  it('emits events in the declared order', () => {
    const bus = createEventBus();
    const types: string[] = [];
    bus.on((event) => types.push(event.type));

    const handle = playDemoEvents(bus);
    vi.advanceTimersByTime(handle.totalDurationMs);

    expect(types).toEqual(DEMO_SCRIPT.map((step) => step.event.type));
  });

  it('fires onFinish after the last event', () => {
    const bus = createEventBus();
    const onFinish = vi.fn();

    const handle = playDemoEvents(bus, { onFinish });
    vi.advanceTimersByTime(handle.totalDurationMs - 1);
    expect(onFinish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it('cancel stops future emissions', () => {
    const bus = createEventBus();
    const events: MaestroEvent[] = [];
    bus.on((event) => events.push(event));

    const handle = playDemoEvents(bus);
    vi.advanceTimersByTime(150);
    const before = events.length;
    handle.cancel();
    vi.advanceTimersByTime(handle.totalDurationMs);

    expect(events.length).toBe(before);
  });

  it('accepts a custom script', () => {
    const bus = createEventBus();
    const events: MaestroEvent[] = [];
    bus.on((event) => events.push(event));

    const handle = playDemoEvents(bus, {
      script: [
        { delayMs: 10, event: { type: 'pipeline.started', runId: 'x' } },
        {
          delayMs: 10,
          event: { type: 'pipeline.completed', runId: 'x', durationMs: 1 },
        },
      ],
    });
    vi.advanceTimersByTime(handle.totalDurationMs);

    expect(events.map((event) => event.type)).toEqual([
      'pipeline.started',
      'pipeline.completed',
    ]);
  });
});
