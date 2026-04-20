import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from './events.js';

describe('createEventBus', () => {
  it('delivers events to every listener', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on(a);
    bus.on(b);

    bus.emit({ type: 'agent.started', agentId: 'planner', runId: 'r1' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribe stops further deliveries', () => {
    const bus = createEventBus();
    const a = vi.fn();
    const off = bus.on(a);
    off();
    bus.emit({ type: 'agent.started', agentId: 'planner', runId: 'r1' });
    expect(a).not.toHaveBeenCalled();
  });

  it('swallows listener exceptions so producers continue', () => {
    const bus = createEventBus();
    const failing = vi.fn(() => {
      throw new Error('boom');
    });
    const ok = vi.fn();
    bus.on(failing);
    bus.on(ok);
    bus.emit({ type: 'agent.started', agentId: 'x', runId: 'r1' });
    expect(failing).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
