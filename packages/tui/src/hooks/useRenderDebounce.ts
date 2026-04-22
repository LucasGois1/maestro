import { useEffect, useMemo } from 'react';

import type { TuiStore } from '../state/store.js';

export const DEFAULT_FRAME_MS = 16;

export type ScheduleFn = (callback: () => void, ms: number) => unknown;
export type ClearFn = (handle: unknown) => void;
export type NowFn = () => number;

export interface FrameThrottleOptions {
  readonly frameMs?: number;
  readonly now?: NowFn;
  readonly schedule?: ScheduleFn;
  readonly clear?: ClearFn;
}

export interface FrameThrottle {
  notify(listener: () => void): void;
  dispose(): void;
}

export function createFrameThrottle(
  options: FrameThrottleOptions = {},
): FrameThrottle {
  const frameMs = options.frameMs ?? DEFAULT_FRAME_MS;
  const schedule: ScheduleFn =
    options.schedule ?? ((cb, ms) => setTimeout(cb, ms));
  const clear: ClearFn =
    options.clear ??
    ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let pending: unknown = null;
  let pendingListener: (() => void) | null = null;
  let disposed = false;

  return {
    notify(listener) {
      if (disposed) {
        return;
      }
      pendingListener = listener;
      if (pending !== null) {
        return;
      }
      pending = schedule(() => {
        pending = null;
        if (disposed) {
          return;
        }
        const toCall = pendingListener;
        pendingListener = null;
        if (toCall) {
          toCall();
        }
      }, frameMs);
    },
    dispose() {
      disposed = true;
      if (pending !== null) {
        clear(pending);
        pending = null;
      }
      pendingListener = null;
    },
  };
}

export function createDebouncedStore(
  store: TuiStore,
  options: FrameThrottleOptions = {},
): TuiStore {
  const throttle = createFrameThrottle(options);

  const wrappedSubscribe = (listener: () => void): (() => void) => {
    const unsubscribe = store.subscribe(() => {
      throttle.notify(listener);
    });
    return () => {
      unsubscribe();
    };
  };

  return {
    getState: () => store.getState(),
    setState: (updater) => store.setState(updater),
    subscribe: wrappedSubscribe,
    select(selector, listener, selectOptions) {
      const equalityFn = selectOptions?.equalityFn ?? Object.is;
      let lastValue = selector(store.getState());
      const inner = () => {
        const nextValue = selector(store.getState());
        if (!equalityFn(nextValue, lastValue)) {
          lastValue = nextValue;
          listener(nextValue);
        }
      };
      return wrappedSubscribe(inner);
    },
  };
}

export interface UseRenderDebounceResult {
  readonly debouncedStore: TuiStore;
  readonly dispose: () => void;
}

export function useRenderDebounce(
  store: TuiStore,
  options: FrameThrottleOptions = {},
): TuiStore {
  const frameMs = options.frameMs ?? DEFAULT_FRAME_MS;
  const schedule = options.schedule;
  const clear = options.clear;
  const now = options.now;

  const wrapped = useMemo(() => {
    const throttleOptions: FrameThrottleOptions = { frameMs };
    if (schedule) {
      (throttleOptions as Mutable<FrameThrottleOptions>).schedule = schedule;
    }
    if (clear) {
      (throttleOptions as Mutable<FrameThrottleOptions>).clear = clear;
    }
    if (now) {
      (throttleOptions as Mutable<FrameThrottleOptions>).now = now;
    }
    return createDebouncedStore(store, throttleOptions);
  }, [store, frameMs, schedule, clear, now]);

  useEffect(
    () => () => {
      // intentionally no-op on unmount; handle teardown externally
    },
    [wrapped],
  );

  return wrapped;
}

type Mutable<T> = { -readonly [P in keyof T]: T[P] };
