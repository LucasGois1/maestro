import type { PipelineStageName } from '@maestro/core';

export type TuiMode = 'idle' | 'discovery' | 'run';

export type TuiDiscoveryPhase =
  | 'detecting'
  | 'structuring'
  | 'inferring'
  | 'preview'
  | 'done'
  | 'error';

/** Visual step for the discovery checklist (derived from `phase` via `getDiscoveryChecklist`). */
export type DiscoveryChecklistItemStatus =
  | 'pending'
  | 'current'
  | 'done'
  | 'failed';

export interface TuiDiscoveryState {
  readonly phase: TuiDiscoveryPhase;
  /** Provider + model ref chosen before this screen (e.g. `openai · openai/gpt-4o-mini`). */
  readonly providerSummary: string | null;
  readonly stackSummary: string | null;
  readonly structureSummary: string | null;
  /** Short line (e.g. schema validation failed). */
  readonly errorSummary: string | null;
  /** Multi-line detail for the discovery error (issues, raw snippet). */
  readonly errorDetail: string | null;
  /** Path to `.maestro/logs/discovery-*.log` when logging is enabled. */
  readonly logFilePath: string | null;
  /** Sub-step during inferential discovery (sampling vs LLM). */
  readonly progressHint: string | null;
  /** Trailing text from the LLM stream while inferring (for live feedback). */
  readonly agentStreamTail: string | null;
  readonly proposedAgentsMd: string | null;
  readonly proposedArchitectureMd: string | null;
}

export interface DiscoveryChecklistRow {
  readonly id: 'stack' | 'structure' | 'infer' | 'preview';
  readonly label: string;
  readonly status: DiscoveryChecklistItemStatus;
}

const DISCOVERY_CHECKLIST_IDS = [
  'stack',
  'structure',
  'infer',
  'preview',
] as const;

const DISCOVERY_CHECKLIST_LABELS = [
  'Detect stack',
  'Analyse structure',
  'Infer AGENTS.md & ARCHITECTURE.md (LLM)',
  'Preview & apply',
] as const;

function discoveryChecklistRow(
  index: 0 | 1 | 2 | 3,
  status: DiscoveryChecklistItemStatus,
): DiscoveryChecklistRow {
  return {
    id: DISCOVERY_CHECKLIST_IDS[index],
    label: DISCOVERY_CHECKLIST_LABELS[index],
    status,
  };
}

/** Checklist rows for DiscoveryScreen; status follows `phase`. */
export function getDiscoveryChecklist(
  phase: TuiDiscoveryPhase,
): readonly DiscoveryChecklistRow[] {
  switch (phase) {
    case 'detecting':
      return [
        discoveryChecklistRow(0, 'current'),
        discoveryChecklistRow(1, 'pending'),
        discoveryChecklistRow(2, 'pending'),
        discoveryChecklistRow(3, 'pending'),
      ];
    case 'structuring':
      return [
        discoveryChecklistRow(0, 'done'),
        discoveryChecklistRow(1, 'current'),
        discoveryChecklistRow(2, 'pending'),
        discoveryChecklistRow(3, 'pending'),
      ];
    case 'inferring':
      return [
        discoveryChecklistRow(0, 'done'),
        discoveryChecklistRow(1, 'done'),
        discoveryChecklistRow(2, 'current'),
        discoveryChecklistRow(3, 'pending'),
      ];
    case 'preview':
      return [
        discoveryChecklistRow(0, 'done'),
        discoveryChecklistRow(1, 'done'),
        discoveryChecklistRow(2, 'done'),
        discoveryChecklistRow(3, 'current'),
      ];
    case 'done':
      return [
        discoveryChecklistRow(0, 'done'),
        discoveryChecklistRow(1, 'done'),
        discoveryChecklistRow(2, 'done'),
        discoveryChecklistRow(3, 'done'),
      ];
    case 'error':
      return [
        discoveryChecklistRow(0, 'done'),
        discoveryChecklistRow(1, 'done'),
        discoveryChecklistRow(2, 'failed'),
        discoveryChecklistRow(3, 'pending'),
      ];
    default: {
      const pending: DiscoveryChecklistItemStatus = 'pending';
      return [
        discoveryChecklistRow(0, pending),
        discoveryChecklistRow(1, pending),
        discoveryChecklistRow(2, pending),
        discoveryChecklistRow(3, pending),
      ];
    }
  }
}

export type TuiPipelineStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

export type TuiSensorStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'warned'
  | 'skipped'
  | 'timeout'
  | 'error';

export type TuiColorMode = 'color' | 'no-color';

export type TuiStageStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'paused'
  | 'escalated';

export interface TuiStageRecord {
  readonly stage: PipelineStageName;
  readonly startedAt: number;
  readonly endedAt: number | null;
}

export type TuiAgentLogKind = 'delta' | 'decision' | 'tool_call';

export interface TuiAgentLogEntry {
  readonly kind: TuiAgentLogKind;
  readonly agentId: string;
  readonly at: number;
  readonly text: string;
}

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
  readonly history: readonly TuiStageRecord[];
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
  readonly messageLog: readonly TuiAgentLogEntry[];
  readonly error: string | null;
}

export interface TuiSensorViolation {
  readonly file: string;
  readonly line: number | null;
  readonly message: string;
}

export interface TuiSensorState {
  readonly sensorId: string;
  readonly kind: 'computational' | 'inferential';
  readonly status: TuiSensorStatus;
  readonly message: string | null;
  readonly durationMs: number | null;
  readonly onFail: 'block' | 'warn' | null;
  /** Accumulated progress / stdout-style output for overlay detail. */
  readonly stdout: string | null;
  readonly stderr: string | null;
  readonly violations: readonly TuiSensorViolation[];
}

export interface TuiFocusState {
  readonly panelId: TuiPanelId;
  readonly overlayStack: readonly string[];
  readonly selectedSprintIdx: number | null;
  /** Selected row in Sensors panel (for detail overlay). */
  readonly focusedSensorId: string | null;
}

export type TuiPanelId =
  | 'pipeline'
  | 'activeAgent'
  | 'sprints'
  | 'sensors'
  | 'diff';

export interface TuiFeedbackEntry {
  readonly at: number;
  readonly sprintIdx: number | null;
  /** 1-based attempt within the sprint (or global if sprint unknown). */
  readonly attempt: number;
  readonly criterion: string;
  readonly failure: string;
  readonly file: string | null;
  readonly line: number | null;
  readonly suggestedAction: string | null;
}

export interface TuiDiffPreviewState {
  readonly mode: 'diff' | 'preview' | 'feedback';
  readonly activePath: string | null;
  /** Unified diff text for `activePath` (also keyed in `diffByPath`). */
  readonly unifiedDiff: string;
  readonly changedPaths: readonly string[];
  readonly activeIndex: number;
  readonly diffByPath: Readonly<Record<string, string>>;
  readonly feedback: TuiFeedbackEntry | null;
  readonly feedbackHistory: readonly TuiFeedbackEntry[];
}

export interface TuiState {
  readonly mode: TuiMode;
  /** Set by `pipeline.started` for CLI/editor integrations. */
  readonly runId: string | null;
  /** Repo-relative paths the agent read during the run (from `kb.file_read`). */
  readonly kbPathsRead: readonly string[];
  readonly discovery: TuiDiscoveryState;
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
export const DEFAULT_AGENT_LOG_BUFFER = 120;
export const DEFAULT_FEEDBACK_HISTORY_CAP = 24;
export const DEFAULT_DIFF_VIEWPORT_LINES = 32;

export const PIPELINE_STAGE_ORDER: readonly PipelineStageName[] = [
  'discovering',
  'planning',
  'architecting',
  'contracting',
  'generating',
  'evaluating',
  'merging',
];

export function createInitialTuiState(
  overrides: Partial<TuiState> = {},
): TuiState {
  return {
    mode: 'idle',
    runId: null,
    kbPathsRead: [],
    discovery: {
      phase: 'detecting',
      providerSummary: null,
      stackSummary: null,
      structureSummary: null,
      errorSummary: null,
      errorDetail: null,
      logFilePath: null,
      progressHint: null,
      agentStreamTail: null,
      proposedAgentsMd: null,
      proposedArchitectureMd: null,
    },
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
      history: [],
    },
    sprints: [],
    agent: {
      activeAgentId: null,
      lastDelta: '',
      decisions: [],
      messageLog: [],
      error: null,
    },
    sensors: {},
    focus: {
      panelId: 'pipeline',
      overlayStack: [],
      selectedSprintIdx: null,
      focusedSensorId: null,
    },
    diffPreview: {
      mode: 'diff',
      activePath: null,
      unifiedDiff: '',
      changedPaths: [],
      activeIndex: 0,
      diffByPath: {},
      feedback: null,
      feedbackHistory: [],
    },
    colorMode: 'color',
    ...overrides,
  };
}

export function createTuiStore(initial: Partial<TuiState> = {}): TuiStore {
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

export type TuiStageStatusMap = Readonly<
  Record<PipelineStageName, TuiStageStatus>
>;

export type TuiStageDurationMap = Readonly<
  Record<PipelineStageName, number | null>
>;

export function computeStageStatuses(
  pipeline: TuiPipelineState,
  sprints: readonly TuiSprintState[],
): TuiStageStatusMap {
  const statuses: Record<PipelineStageName, TuiStageStatus> = {
    discovering: 'pending',
    planning: 'pending',
    architecting: 'pending',
    contracting: 'pending',
    generating: 'pending',
    evaluating: 'pending',
    merging: 'pending',
  };

  const currentIndex =
    pipeline.stage === null ? -1 : PIPELINE_STAGE_ORDER.indexOf(pipeline.stage);

  if (currentIndex !== -1) {
    for (let i = 0; i < currentIndex; i += 1) {
      const stage = PIPELINE_STAGE_ORDER[i];
      if (stage) {
        statuses[stage] = 'passed';
      }
    }
  }

  for (const record of pipeline.history) {
    if (record.endedAt !== null) {
      statuses[record.stage] = 'passed';
    }
  }

  if (pipeline.stage !== null) {
    const hasEscalated = sprints.some(
      (sprint) => sprint.status === 'escalated',
    );
    if (pipeline.status === 'failed') {
      statuses[pipeline.stage] = 'failed';
    } else if (pipeline.status === 'paused') {
      statuses[pipeline.stage] = 'paused';
    } else if (hasEscalated && pipeline.status === 'running') {
      statuses[pipeline.stage] = 'escalated';
    } else if (pipeline.status === 'running') {
      statuses[pipeline.stage] = 'running';
    } else if (pipeline.status === 'completed') {
      statuses[pipeline.stage] = 'passed';
    }
  }

  if (pipeline.status === 'completed') {
    for (const stage of PIPELINE_STAGE_ORDER) {
      if (statuses[stage] === 'running') {
        statuses[stage] = 'passed';
      }
    }
  }

  return statuses;
}

export function computeStageDurations(
  pipeline: TuiPipelineState,
): TuiStageDurationMap {
  const durations: Record<PipelineStageName, number | null> = {
    discovering: null,
    planning: null,
    architecting: null,
    contracting: null,
    generating: null,
    evaluating: null,
    merging: null,
  };

  for (const record of pipeline.history) {
    if (record.endedAt === null) {
      continue;
    }
    const elapsed = record.endedAt - record.startedAt;
    const existing = durations[record.stage];
    durations[record.stage] = existing === null ? elapsed : existing + elapsed;
  }

  return durations;
}

export function selectStageStatuses(state: TuiState): TuiStageStatusMap {
  return computeStageStatuses(state.pipeline, state.sprints);
}

export function selectStageDurations(state: TuiState): TuiStageDurationMap {
  return computeStageDurations(state.pipeline);
}
