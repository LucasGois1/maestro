import { describe, expect, it, vi } from 'vitest';

import {
  computeStageDurations,
  computeStageStatuses,
  createInitialTuiState,
  createTuiStore,
  DEFAULT_AGENT_LOG_BUFFER,
  getDiscoveryChecklist,
  PIPELINE_STAGE_ORDER,
  selectStageDurations,
  selectStageStatuses,
} from './store.js';

describe('createTuiStore', () => {
  it('returns the initial state with defaults', () => {
    const store = createTuiStore();

    const state = store.getState();

    expect(state.mode).toBe('idle');
    expect(state.discovery.phase).toBe('detecting');
    expect(state.discovery.providerSummary).toBeNull();
    expect(state.pipeline.status).toBe('idle');
    expect(state.sprints).toEqual([]);
    expect(state.sensors).toEqual({});
    expect(state.focus.panelId).toBe('pipeline');
    expect(state.focus.overlayStack).toEqual([]);
    expect(state.diffPreview.mode).toBe('diff');
    expect(state.diffPreview.unifiedDiff).toBe('');
    expect(state.diffPreview.changedPaths).toEqual([]);
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
          a.length === b.length &&
          a.every((value, index) => value === b[index]),
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

  it('initial state includes new DSFT-87 fields with safe defaults', () => {
    const state = createInitialTuiState();
    expect(state.pipeline.history).toEqual([]);
    expect(state.agent.messageLog).toEqual([]);
    expect(state.focus.selectedSprintIdx).toBeNull();
  });
});

describe('getDiscoveryChecklist', () => {
  it('marks stack as current while detecting', () => {
    const rows = getDiscoveryChecklist('detecting');
    expect(rows[0]?.status).toBe('current');
    expect(rows[1]?.status).toBe('pending');
  });

  it('marks infer as failed on error phase', () => {
    const rows = getDiscoveryChecklist('error');
    expect(rows[2]?.id).toBe('infer');
    expect(rows[2]?.status).toBe('failed');
    expect(rows[3]?.status).toBe('pending');
  });

  it('marks all done when phase is done', () => {
    const rows = getDiscoveryChecklist('done');
    expect(rows.every((r) => r.status === 'done')).toBe(true);
  });
});

describe('PIPELINE_STAGE_ORDER', () => {
  it('lists the 7 canonical pipeline stages in order', () => {
    expect(PIPELINE_STAGE_ORDER).toEqual([
      'discovering',
      'planning',
      'architecting',
      'contracting',
      'generating',
      'evaluating',
      'merging',
    ]);
  });
});

describe('DEFAULT_AGENT_LOG_BUFFER', () => {
  it('is exposed as a constant', () => {
    expect(DEFAULT_AGENT_LOG_BUFFER).toBe(120);
  });
});

describe('computeStageStatuses', () => {
  it('returns all pending for idle pipelines', () => {
    const state = createInitialTuiState();
    const statuses = computeStageStatuses(state.pipeline, state.sprints);
    for (const stage of PIPELINE_STAGE_ORDER) {
      expect(statuses[stage]).toBe('pending');
    }
  });

  it('marks earlier stages as passed and current as running', () => {
    const statuses = computeStageStatuses(
      {
        status: 'running',
        stage: 'generating',
        sprintIdx: 1,
        retryCount: 0,
        error: null,
        history: [
          { stage: 'planning', startedAt: 0, endedAt: 100 },
          { stage: 'architecting', startedAt: 100, endedAt: 200 },
        ],
      },
      [{ idx: 1, status: 'running', retries: 0 }],
    );
    expect(statuses.planning).toBe('passed');
    expect(statuses.architecting).toBe('passed');
    expect(statuses.contracting).toBe('passed');
    expect(statuses.generating).toBe('running');
    expect(statuses.merging).toBe('pending');
  });

  it('marks current stage as failed when pipeline fails', () => {
    const statuses = computeStageStatuses(
      {
        status: 'failed',
        stage: 'evaluating',
        sprintIdx: 1,
        retryCount: 1,
        error: 'oops',
        history: [],
      },
      [],
    );
    expect(statuses.evaluating).toBe('failed');
  });

  it('marks current stage as paused when pipeline is paused', () => {
    const statuses = computeStageStatuses(
      {
        status: 'paused',
        stage: 'generating',
        sprintIdx: 1,
        retryCount: 0,
        error: null,
        history: [],
      },
      [],
    );
    expect(statuses.generating).toBe('paused');
  });

  it('marks current stage as escalated when a sprint is escalated', () => {
    const statuses = computeStageStatuses(
      {
        status: 'running',
        stage: 'generating',
        sprintIdx: 1,
        retryCount: 3,
        error: null,
        history: [],
      },
      [{ idx: 1, status: 'escalated', retries: 3 }],
    );
    expect(statuses.generating).toBe('escalated');
  });

  it('marks all stages as passed on completion', () => {
    const statuses = computeStageStatuses(
      {
        status: 'completed',
        stage: 'merging',
        sprintIdx: 3,
        retryCount: 0,
        error: null,
        history: [
          { stage: 'discovering', startedAt: 0, endedAt: 10 },
          { stage: 'planning', startedAt: 10, endedAt: 20 },
          { stage: 'architecting', startedAt: 20, endedAt: 30 },
          { stage: 'contracting', startedAt: 30, endedAt: 40 },
          { stage: 'generating', startedAt: 40, endedAt: 50 },
          { stage: 'evaluating', startedAt: 50, endedAt: 60 },
          { stage: 'merging', startedAt: 60, endedAt: 70 },
        ],
      },
      [],
    );
    expect(statuses.merging).toBe('passed');
    expect(statuses.discovering).toBe('passed');
  });
});

describe('computeStageDurations', () => {
  it('returns null durations when history is empty', () => {
    const durations = computeStageDurations(createInitialTuiState().pipeline);
    expect(durations.planning).toBeNull();
  });

  it('sums durations per stage', () => {
    const durations = computeStageDurations({
      status: 'running',
      stage: 'generating',
      sprintIdx: 1,
      retryCount: 0,
      error: null,
      history: [
        { stage: 'generating', startedAt: 0, endedAt: 500 },
        { stage: 'evaluating', startedAt: 500, endedAt: 700 },
        { stage: 'generating', startedAt: 700, endedAt: 900 },
        { stage: 'merging', startedAt: 900, endedAt: null },
      ],
    });
    expect(durations.generating).toBe(700);
    expect(durations.evaluating).toBe(200);
    expect(durations.merging).toBeNull();
  });
});

describe('selectStageStatuses/selectStageDurations', () => {
  it('delegates to the compute helpers', () => {
    const state = createInitialTuiState();
    expect(selectStageStatuses(state)).toEqual(
      computeStageStatuses(state.pipeline, state.sprints),
    );
    expect(selectStageDurations(state)).toEqual(
      computeStageDurations(state.pipeline),
    );
  });
});
