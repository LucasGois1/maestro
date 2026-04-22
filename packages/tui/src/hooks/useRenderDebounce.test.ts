import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTuiStore } from '../state/store.js';

import {
  createDebouncedStore,
  createFrameThrottle,
  DEFAULT_FRAME_MS,
} from './useRenderDebounce.js';

describe('createFrameThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces rapid notifies into a single trailing call per frame window', () => {
    const throttle = createFrameThrottle({ frameMs: DEFAULT_FRAME_MS });
    const listener = vi.fn();

    for (let i = 0; i < 1000; i += 1) {
      throttle.notify(listener);
    }

    expect(listener).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEFAULT_FRAME_MS);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('respects a custom frame duration', () => {
    const throttle = createFrameThrottle({ frameMs: 100 });
    const listener = vi.fn();

    throttle.notify(listener);
    vi.advanceTimersByTime(50);
    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('enforces the plan cap: N emits in t ms produce ≤ ceil(t/frame) notifications', () => {
    const throttle = createFrameThrottle({ frameMs: DEFAULT_FRAME_MS });
    const listener = vi.fn();

    const totalDurationMs = 100;
    for (let i = 0; i < 1000; i += 1) {
      throttle.notify(listener);
    }

    vi.advanceTimersByTime(totalDurationMs);

    const expectedCap = Math.ceil(totalDurationMs / DEFAULT_FRAME_MS);
    expect(listener.mock.calls.length).toBeLessThanOrEqual(expectedCap);
  });

  it('dispose cancels a pending notification', () => {
    const throttle = createFrameThrottle({ frameMs: DEFAULT_FRAME_MS });
    const listener = vi.fn();

    throttle.notify(listener);
    throttle.dispose();
    vi.advanceTimersByTime(1000);

    expect(listener).not.toHaveBeenCalled();
  });

  it('uses a custom schedule/clear pair when provided', () => {
    const schedule = vi.fn((cb: () => void, _ms: number) => {
      return cb;
    });
    const clear = vi.fn();
    const throttle = createFrameThrottle({ schedule, clear });
    const listener = vi.fn();

    throttle.notify(listener);
    expect(schedule).toHaveBeenCalledOnce();
    expect(clear).not.toHaveBeenCalled();

    throttle.dispose();
    expect(clear).toHaveBeenCalledOnce();
  });
});

describe('createDebouncedStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays subscriber notifications until the next frame window', () => {
    const store = createTuiStore();
    const debounced = createDebouncedStore(store, {
      frameMs: DEFAULT_FRAME_MS,
    });
    const listener = vi.fn();
    debounced.subscribe(listener);

    for (let i = 0; i < 5; i += 1) {
      store.setState((state) => ({ ...state, mode: 'run' }));
      store.setState((state) => ({ ...state, mode: 'idle' }));
    }

    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_FRAME_MS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('select honours the debounce', () => {
    const store = createTuiStore();
    const debounced = createDebouncedStore(store, {
      frameMs: DEFAULT_FRAME_MS,
    });
    const listener = vi.fn();
    debounced.select((state) => state.mode, listener);

    store.setState((state) => ({ ...state, mode: 'run' }));
    store.setState((state) => ({ ...state, mode: 'idle' }));
    store.setState((state) => ({ ...state, mode: 'run' }));

    expect(listener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DEFAULT_FRAME_MS);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('run');
  });

  it('passes through getState without delay', () => {
    const store = createTuiStore();
    const debounced = createDebouncedStore(store);
    store.setState((state) => ({ ...state, mode: 'run' }));
    expect(debounced.getState().mode).toBe('run');
  });
});
