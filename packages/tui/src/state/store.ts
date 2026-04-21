import type { PipelineStageName } from '@maestro/core';

export type TuiMode = 'idle' | 'discovery' | 'run';

export type TuiPipelineStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export type TuiSensorStatus =
  | 'running'
  | 'passed'
  | 'failed'
  | 'warned'
  | 'skipped'
  | 'timeout'
  | 'error';

export type TuiColorMode = 'color' | 'no-color';

export interface TuiHeaderState {
  readonly repoName: string | null;
  readonly branch: string | null;
  readonly sprintIdx: number | null;
  readonly totalSprints: number | null;
  readonly contextPct: number | null;
  readonly updateAvailable: boolean;
}

export interface TuiPipelineState {
  readonly status: TuiPipelineStatus;
  readonly stage: PipelineStageName | null;
  readonly sprintIdx: number | null;
  readonly retryCount: number;
  readonly error: string | null;
}

export interface TuiSprintState {
  readonly idx: number;
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'escalated';
  readonly retries: number;
}

export interface TuiAgentDecision {
  readonly agentId: string;
  readonly message: string;
  readonly at: number;
}

export interface TuiAgentState {
  readonly activeAgentId: string | null;
  readonly lastDelta: string;
  readonly decisions: readonly TuiAgentDecision[];
  readonly error: string | null;
}

export interface TuiSensorState {
  readonly sensorId: string;
  readonly kind: 'computational' | 'inferential';
  readonly status: TuiSensorStatus;
  readonly message: string | null;
}

export interface TuiFocusState {
  readonly panelId: TuiPanelId;
  readonly overlayStack: readonly string[];
}

export type TuiPanelId =
  | 'pipeline'
  | 'activeAgent'
  | 'sprints'
  | 'sensors'
  | 'diff';

export interface TuiDiffPreviewState {
  readonly mode: 'diff' | 'preview' | 'feedback';
}

export interface TuiState {
  readonly mode: TuiMode;
  readonly header: TuiHeaderState;
  readonly pipeline: TuiPipelineState;
  readonly sprints: readonly TuiSprintState[];
  readonly agent: TuiAgentState;
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
  readonly focus: TuiFocusState;
  readonly diffPreview: TuiDiffPreviewState;
  readonly colorMode: TuiColorMode;
}

export type TuiStateUpdater = (previous: TuiState) => TuiState;

export interface TuiStore {
  getState(): TuiState;
  setState(updater: TuiStateUpdater): void;
  subscribe(listener: () => void): () => void;
  select<T>(
    selector: (state: TuiState) => T,
    listener: (value: T) => void,
    options?: { readonly equalityFn?: (a: T, b: T) => boolean },
  ): () => void;
}

export const PANEL_FOCUS_ORDER: readonly TuiPanelId[] = [
  'pipeline',
  'activeAgent',
  'sprints',
  'sensors',
  'diff',
];

export const DEFAULT_AGENT_DECISION_BUFFER = 200;

export function createInitialTuiState(
  overrides: Partial<TuiState> = {},
): TuiState {
  return {
    mode: 'idle',
    header: {
      repoName: null,
      branch: null,
      sprintIdx: null,
      totalSprints: null,
      contextPct: null,
      updateAvailable: false,
    },
    pipeline: {
      status: 'idle',
      stage: null,
      sprintIdx: null,
      retryCount: 0,
      error: null,
    },
    sprints: [],
    agent: {
      activeAgentId: null,
      lastDelta: '',
      decisions: [],
      error: null,
    },
    sensors: {},
    focus: {
      panelId: 'pipeline',
      overlayStack: [],
    },
    diffPreview: { mode: 'diff' },
    colorMode: 'color',
    ...overrides,
  };
}

export function createTuiStore(
  initial: Partial<TuiState> = {},
): TuiStore {
  let state = createInitialTuiState(initial);
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // listener errors must not break the notification loop
      }
    }
  };

  return {
    getState() {
      return state;
    },
    setState(updater) {
      const next = updater(state);
      if (Object.is(next, state)) {
        return;
      }
      state = next;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    select(selector, listener, options = {}) {
      const equalityFn = options.equalityFn ?? Object.is;
      let lastValue = selector(state);
      const subscriberListener = () => {
        const nextValue = selector(state);
        if (!equalityFn(nextValue, lastValue)) {
          lastValue = nextValue;
          listener(nextValue);
        }
      };
      listeners.add(subscriberListener);
      return () => {
        listeners.delete(subscriberListener);
      };
    },
  };
}
