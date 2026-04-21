import { describe, expect, it, vi } from 'vitest';

import { createInitialTuiState, createTuiStore } from './store.js';

describe('createTuiStore', () => {
  it('returns the initial state with defaults', () => {
    const store = createTuiStore();

    const state = store.getState();

    expect(state.mode).toBe('idle');
    expect(state.pipeline.status).toBe('idle');
    expect(state.sprints).toEqual([]);
    expect(state.sensors).toEqual({});
    expect(state.focus.panelId).toBe('pipeline');
    expect(state.focus.overlayStack).toEqual([]);
    expect(state.diffPreview.mode).toBe('diff');
    expect(state.colorMode).toBe('color');
  });

  it('applies overrides via createInitialTuiState', () => {
    const state = createInitialTuiState({ colorMode: 'no-color' });
    expect(state.colorMode).toBe('no-color');
  });

  it('updates state immutably via setState', () => {
    const store = createTuiStore();
    const previous = store.getState();

    store.setState((state) => ({
      ...state,
      pipeline: { ...state.pipeline, status: 'running' },
    }));

    expect(store.getState()).not.toBe(previous);
    expect(store.getState().pipeline.status).toBe('running');
    expect(previous.pipeline.status).toBe('idle');
  });

  it('skips notification when updater returns the same reference', () => {
    const store = createTuiStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState((state) => state);

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers once per change and unsubscribes cleanly', () => {
    const store = createTuiStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState((state) => ({ ...state, mode: 'run' }));
    store.setState((state) => ({ ...state, mode: 'run' }));

    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    store.setState((state) => ({ ...state, mode: 'idle' }));

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('isolates listener errors so other subscribers still run', () => {
    const store = createTuiStore();
    const faulty = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    store.subscribe(faulty);
    store.subscribe(healthy);

    store.setState((state) => ({ ...state, mode: 'run' }));

    expect(faulty).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledOnce();
  });

  it('select notifies only when the selected slice changes', () => {
    const store = createTuiStore();
    const listener = vi.fn();

    store.select((state) => state.pipeline.status, listener);

    store.setState((state) => ({
      ...state,
      agent: { ...state.agent, lastDelta: 'hello' },
    }));

    expect(listener).not.toHaveBeenCalled();

    store.setState((state) => ({
      ...state,
      pipeline: { ...state.pipeline, status: 'running' },
    }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith('running');
  });

  it('select supports a custom equality function', () => {
    const store = createTuiStore();
    const listener = vi.fn();

    store.select(
      (state) => state.sprints.map((sprint) => sprint.idx),
      listener,
      {
        equalityFn: (a, b) =>
          a.length === b.length && a.every((value, index) => value === b[index]),
      },
    );

    store.setState((state) => ({
      ...state,
      sprints: [{ idx: 1, status: 'running', retries: 0 }],
    }));
    store.setState((state) => ({
      ...state,
      sprints: [{ idx: 1, status: 'done', retries: 0 }],
    }));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('select unsubscribe removes the listener', () => {
    const store = createTuiStore();
    const listener = vi.fn();
    const unsubscribe = store.select((state) => state.mode, listener);

    unsubscribe();
    store.setState((state) => ({ ...state, mode: 'run' }));

    expect(listener).not.toHaveBeenCalled();
  });
});
