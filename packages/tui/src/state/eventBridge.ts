import type {
  AgentEvent,
  ContextEvent,
  EventBus,
  MaestroEvent,
  PipelineEvent,
  SensorEvent,
} from '@maestro/core';

import { formatToolCallSummary } from '../format-tool-call-summary.js';
import type {
  TuiAgentLogEntry,
  TuiFeedbackEntry,
  TuiSensorStatus,
  TuiSprintState,
  TuiStageRecord,
  TuiStore,
} from './store.js';
import {
  appendRecentRun,
  DEFAULT_FEEDBACK_HISTORY_CAP,
} from './store.js';

export interface BridgeBusOptions {
  readonly agentDeltaBufferChars?: number;
  readonly agentDecisionBufferSize?: number;
  readonly agentLogBufferSize?: number;
  readonly clock?: () => number;
}

const DEFAULT_DELTA_BUFFER_CHARS = 8_000;
const DEFAULT_DECISION_BUFFER_SIZE = 200;
const DEFAULT_LOG_BUFFER_SIZE = 120;

/**
 * Subscribes once to `bus` and mirrors events into `store`. When using the TUI
 * `App` with the same `bus` and `store`, avoid calling this from the CLI as well:
 * `App` already subscribes in a `useLayoutEffect` (double subscription duplicates log lines).
 */
export function bridgeBusToStore(
  bus: EventBus,
  store: TuiStore,
  options: BridgeBusOptions = {},
): () => void {
  const deltaCap = options.agentDeltaBufferChars ?? DEFAULT_DELTA_BUFFER_CHARS;
  const decisionCap =
    options.agentDecisionBufferSize ?? DEFAULT_DECISION_BUFFER_SIZE;
  const logCap = options.agentLogBufferSize ?? DEFAULT_LOG_BUFFER_SIZE;
  const clock = options.clock ?? Date.now;
  const feedbackAttemptByRunSprint = new Map<string, number>();

  return bus.on((event) => {
    handleEvent(event, store, {
      deltaCap,
      decisionCap,
      logCap,
      clock,
      feedbackAttemptByRunSprint,
    });
  });
}

interface InternalConfig {
  readonly deltaCap: number;
  readonly decisionCap: number;
  readonly logCap: number;
  readonly clock: () => number;
  readonly feedbackAttemptByRunSprint: Map<string, number>;
}

function handleShellApprovalEvent(event: MaestroEvent, store: TuiStore): void {
  if (event.type === 'shell.approval_pending') {
    store.setState((state) => ({
      ...state,
      runId: event.runId,
      pipeline: {
        ...state.pipeline,
        shellApprovalPending: {
          runId: event.runId,
          requestId: event.requestId,
          cmd: event.cmd,
          ...(event.agentId !== undefined ? { agentId: event.agentId } : {}),
          commandLine: event.commandLine,
          cwd: event.cwd,
          reason: event.reason,
        },
      },
    }));
    return;
  }
  if (event.type === 'shell.approval_resolved') {
    store.setState((state) => {
      const pending = state.pipeline.shellApprovalPending;
      if (pending === null || pending.requestId !== event.requestId) {
        return state;
      }
      return {
        ...state,
        pipeline: {
          ...state.pipeline,
          shellApprovalPending: null,
        },
      };
    });
  }
}

function handleEvent(
  event: MaestroEvent,
  store: TuiStore,
  config: InternalConfig,
): void {
  if (
    event.type === 'shell.approval_pending' ||
    event.type === 'shell.approval_resolved'
  ) {
    handleShellApprovalEvent(event, store);
    return;
  }
  if (isPipelineEvent(event)) {
    handlePipelineEvent(event, store, config);
    return;
  }
  if (isAgentEvent(event)) {
    handleAgentEvent(event, store, config);
    return;
  }
  if (isContextEvent(event)) {
    handleContextEvent(event, store, config);
    return;
  }
  handleSensorEvent(event, store);
}

function isPipelineEvent(event: MaestroEvent): event is PipelineEvent {
  return event.type.startsWith('pipeline.');
}

function isAgentEvent(event: MaestroEvent): event is AgentEvent {
  return event.type.startsWith('agent.');
}

function isContextEvent(event: MaestroEvent): event is ContextEvent {
  return (
    event.type === 'artifact.diff_updated' ||
    event.type === 'evaluator.feedback' ||
    event.type === 'kb.file_read'
  );
}

function closeOpenStage(
  history: readonly TuiStageRecord[],
  at: number,
): readonly TuiStageRecord[] {
  if (history.length === 0) {
    return history;
  }
  const last = history[history.length - 1];
  if (!last || last.endedAt !== null) {
    return history;
  }
  const next = history.slice();
  next[next.length - 1] = { ...last, endedAt: at };
  return next;
}

function appendStageRecord(
  history: readonly TuiStageRecord[],
  record: TuiStageRecord,
): readonly TuiStageRecord[] {
  return [...history, record];
}

function handlePipelineEvent(
  event: PipelineEvent,
  store: TuiStore,
  config: InternalConfig,
): void {
  switch (event.type) {
    case 'pipeline.started':
      config.feedbackAttemptByRunSprint.clear();
      store.setState((state) => ({
        ...state,
        runId: event.runId,
        kbPathsRead: [],
        mode: 'run',
        pipeline: {
          ...state.pipeline,
          status: 'running',
          error: null,
          stage: null,
          sprintIdx: null,
          retryCount: 0,
          history: [],
          escalationDetail: null,
          shellApprovalPending: null,
        },
        focus: {
          ...state.focus,
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
      }));
      return;
    case 'pipeline.stage_entered':
      store.setState((state) => {
        const now = config.clock();
        const closed = closeOpenStage(state.pipeline.history, now);
        const withNew = appendStageRecord(closed, {
          stage: event.stage,
          startedAt: now,
          endedAt: null,
        });
        const nextDiffMode =
          event.stage === 'generating'
            ? ('diff' as const)
            : event.stage === 'evaluating'
              ? ('preview' as const)
              : state.diffPreview.mode;
        return {
          ...state,
          pipeline: {
            ...state.pipeline,
            stage: event.stage,
            sprintIdx: event.sprintIdx ?? state.pipeline.sprintIdx,
            history: withNew,
          },
          header:
            event.sprintIdx === undefined
              ? state.header
              : { ...state.header, sprintIdx: event.sprintIdx },
          diffPreview: {
            ...state.diffPreview,
            mode: nextDiffMode,
          },
        };
      });
      return;
    case 'pipeline.sprint_started':
      store.setState((state) => {
        const previousIdx = state.pipeline.sprintIdx;
        const sprints = upsertSprint(
          closePreviousRunningSprints(state.sprints, event.sprintIdx),
          {
            idx: event.sprintIdx,
            status: 'running',
            retries: 0,
          },
        );
        return {
          ...state,
          pipeline: {
            ...state.pipeline,
            sprintIdx: event.sprintIdx,
            retryCount:
              previousIdx === event.sprintIdx ? state.pipeline.retryCount : 0,
          },
          header: {
            ...state.header,
            sprintIdx: event.sprintIdx,
            totalSprints: event.totalSprints,
          },
          sprints,
        };
      });
      return;
    case 'pipeline.sprint_retried':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          retryCount: event.retry,
        },
        sprints: upsertSprint(state.sprints, {
          idx: event.sprintIdx,
          status: 'running',
          retries: event.retry,
        }),
      }));
      return;
    case 'pipeline.plan_revised':
      store.setState((state) => {
        const at = config.clock();
        const message = `Plan revised (attempt ${event.attempt.toString()}): ${event.reasonSummary}`;
        const decision = {
          agentId: 'planner',
          message,
          at,
        };
        const nextDecisions = [...state.agent.decisions, decision];
        const trimmedDecisions =
          nextDecisions.length > config.decisionCap
            ? nextDecisions.slice(nextDecisions.length - config.decisionCap)
            : nextDecisions;
        const entry: TuiAgentLogEntry = {
          kind: 'decision',
          agentId: 'planner',
          at,
          text: message,
        };
        return {
          ...state,
          agent: {
            ...state.agent,
            decisions: trimmedDecisions,
            messageLog: appendAgentLog(
              state.agent.messageLog,
              entry,
              config.logCap,
            ),
          },
        };
      });
      return;
    case 'pipeline.sprint_escalated':
      store.setState((state) => ({
        ...state,
        sprints: upsertSprint(state.sprints, {
          idx: event.sprintIdx,
          status: 'escalated',
          retries: state.pipeline.retryCount,
        }),
      }));
      return;
    case 'pipeline.escalation_pending':
      store.setState((state) => ({
        ...state,
        runId: event.runId,
        mode: 'run',
        pipeline: {
          ...state.pipeline,
          status: 'escalated',
          stage: event.phaseAtEscalation,
          sprintIdx: event.sprintIdx,
          error: null,
          shellApprovalPending: null,
          escalationDetail: {
            reason: event.reason,
            sprintIdx: event.sprintIdx,
            source: event.source,
            phaseAtEscalation: event.phaseAtEscalation,
            resumeTarget: event.resumeTarget,
            ...(event.artifactHints !== undefined
              ? { artifactHints: event.artifactHints }
              : {}),
          },
        },
        header: {
          ...state.header,
          sprintIdx: event.sprintIdx,
        },
      }));
      return;
    case 'pipeline.paused':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'paused',
          stage: event.at,
          escalationDetail: null,
          shellApprovalPending: null,
        },
      }));
      return;
    case 'pipeline.resumed':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'running',
          stage:
            event.from === 'escalated'
              ? (event.phaseBeforeEscalation ?? state.pipeline.stage)
              : event.from,
          escalationDetail: null,
          shellApprovalPending: null,
        },
      }));
      return;
    case 'pipeline.completed':
      store.setState((state) => {
        const now = config.clock();
        const closed = closeOpenStage(state.pipeline.history, now);
        return {
          ...state,
          pipeline: {
            ...state.pipeline,
            status: 'completed',
            history: closed,
            escalationDetail: null,
            shellApprovalPending: null,
          },
          sprints: state.sprints.map((sprint) =>
            sprint.status === 'running'
              ? { ...sprint, status: 'done' }
              : sprint,
          ),
          recentRuns: appendRecentRun(state.recentRuns, {
            runId: event.runId,
            status: 'completed',
            at: now,
            durationMs: event.durationMs,
          }),
        };
      });
      return;
    case 'pipeline.failed':
      store.setState((state) => {
        const now = config.clock();
        const closed = closeOpenStage(state.pipeline.history, now);
        const activeIdx = state.pipeline.sprintIdx;
        return {
          ...state,
          pipeline: {
            ...state.pipeline,
            status: 'failed',
            stage: event.at,
            error: event.error,
            history: closed,
            escalationDetail: null,
            shellApprovalPending: null,
          },
          sprints:
            activeIdx === null
              ? state.sprints
              : state.sprints.map((sprint) =>
                  sprint.idx === activeIdx
                    ? { ...sprint, status: 'failed' }
                    : sprint,
                ),
          recentRuns: appendRecentRun(state.recentRuns, {
            runId: event.runId,
            status: 'failed',
            at: now,
          }),
        };
      });
  }
}

function appendAgentLog(
  log: readonly TuiAgentLogEntry[],
  entry: TuiAgentLogEntry,
  cap: number,
): readonly TuiAgentLogEntry[] {
  const next = [...log, entry];
  if (next.length <= cap) {
    return next;
  }
  return next.slice(next.length - cap);
}

function handleAgentEvent(
  event: AgentEvent,
  store: TuiStore,
  config: InternalConfig,
): void {
  switch (event.type) {
    case 'agent.started':
      store.setState((state) => ({
        ...state,
        agent: {
          ...state.agent,
          activeAgentId: event.agentId,
          lastDelta: '',
          messageLog: [],
          error: null,
        },
      }));
      return;
    case 'agent.delta':
      store.setState((state) => {
        const next = state.agent.lastDelta + event.chunk;
        const trimmed =
          next.length > config.deltaCap
            ? next.slice(next.length - config.deltaCap)
            : next;
        const entry: TuiAgentLogEntry = {
          kind: 'delta',
          agentId: event.agentId,
          at: config.clock(),
          text: event.chunk,
        };
        return {
          ...state,
          agent: {
            ...state.agent,
            lastDelta: trimmed,
            messageLog: appendAgentLog(
              state.agent.messageLog,
              entry,
              config.logCap,
            ),
          },
        };
      });
      return;
    case 'agent.decision':
      store.setState((state) => {
        const at = config.clock();
        const decision = {
          agentId: event.agentId,
          message: event.message,
          at,
        };
        const nextDecisions = [...state.agent.decisions, decision];
        const trimmedDecisions =
          nextDecisions.length > config.decisionCap
            ? nextDecisions.slice(nextDecisions.length - config.decisionCap)
            : nextDecisions;
        const entry: TuiAgentLogEntry = {
          kind: 'decision',
          agentId: event.agentId,
          at,
          text: event.message,
        };
        return {
          ...state,
          agent: {
            ...state.agent,
            decisions: trimmedDecisions,
            messageLog: appendAgentLog(
              state.agent.messageLog,
              entry,
              config.logCap,
            ),
          },
        };
      });
      return;
    case 'agent.tool_call':
      store.setState((state) => {
        const entry: TuiAgentLogEntry = {
          kind: 'tool_call',
          agentId: event.agentId,
          at: config.clock(),
          text: formatToolCallSummary(event.tool, event.args),
        };
        return {
          ...state,
          agent: {
            ...state.agent,
            messageLog: appendAgentLog(
              state.agent.messageLog,
              entry,
              config.logCap,
            ),
          },
        };
      });
      return;
    case 'agent.tool_result':
      return;
    case 'agent.completed':
      store.setState((state) => ({
        ...state,
        agent: { ...state.agent, activeAgentId: null },
      }));
      return;
    case 'agent.failed':
      store.setState((state) => ({
        ...state,
        agent: { ...state.agent, activeAgentId: null, error: event.error },
      }));
  }
}

function handleContextEvent(
  event: ContextEvent,
  store: TuiStore,
  config: InternalConfig,
): void {
  if (event.type === 'kb.file_read') {
    store.setState((state) => {
      if (state.kbPathsRead.includes(event.path)) {
        return state;
      }
      return {
        ...state,
        kbPathsRead: [...state.kbPathsRead, event.path],
      };
    });
    return;
  }

  if (event.type === 'artifact.diff_updated') {
    store.setState((state) => {
      const paths =
        event.changedPaths.length > 0
          ? event.changedPaths
          : event.activePath
            ? [event.activePath]
            : state.diffPreview.changedPaths;
      const nextDiffByPath = {
        ...state.diffPreview.diffByPath,
        [event.activePath]: event.unifiedDiff,
      };
      return {
        ...state,
        diffPreview: {
          ...state.diffPreview,
          mode: 'diff',
          activePath: event.activePath,
          unifiedDiff: event.unifiedDiff,
          changedPaths: paths,
          activeIndex: event.activeIndex,
          diffByPath: nextDiffByPath,
        },
      };
    });
    return;
  }

  if (event.type === 'evaluator.feedback') {
    store.setState((state) => {
      const at = config.clock();
      const sprintIdx =
        event.sprintIdx ?? state.pipeline.sprintIdx ?? state.header.sprintIdx;
      const attemptKey = `${event.runId}:${sprintIdx !== null ? sprintIdx.toString() : 'na'}`;
      let attempt: number;
      if (event.attempt !== undefined) {
        attempt = event.attempt;
      } else {
        const prev = config.feedbackAttemptByRunSprint.get(attemptKey) ?? 0;
        attempt = prev + 1;
        config.feedbackAttemptByRunSprint.set(attemptKey, attempt);
      }
      const entry: TuiFeedbackEntry = {
        at,
        sprintIdx,
        attempt,
        criterion: event.criterion,
        failure: event.failure,
        file: event.file ?? null,
        line: event.line ?? null,
        suggestedAction: event.suggestedAction ?? null,
      };
      const history = [...state.diffPreview.feedbackHistory, entry];
      const capped =
        history.length > DEFAULT_FEEDBACK_HISTORY_CAP
          ? history.slice(history.length - DEFAULT_FEEDBACK_HISTORY_CAP)
          : history;
      return {
        ...state,
        diffPreview: {
          ...state.diffPreview,
          mode: 'feedback',
          feedback: entry,
          feedbackHistory: capped,
        },
      };
    });
  }
}

function handleSensorEvent(event: SensorEvent, store: TuiStore): void {
  switch (event.type) {
    case 'sensor.registered':
      store.setState((state) => ({
        ...state,
        sensors: {
          ...state.sensors,
          [event.sensorId]: {
            sensorId: event.sensorId,
            kind: event.kind,
            status: 'queued',
            message: null,
            durationMs: null,
            onFail: event.onFail,
            stdout: null,
            stderr: null,
            violations: [],
          },
        },
      }));
      return;
    case 'sensor.started':
      store.setState((state) => {
        const previous = state.sensors[event.sensorId];
        const onFail = event.onFail ?? previous?.onFail ?? null;
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: {
              sensorId: event.sensorId,
              kind: event.kind,
              status: 'running',
              message: null,
              durationMs: null,
              onFail,
              stdout: previous?.stdout ?? null,
              stderr: previous?.stderr ?? null,
              violations: previous?.violations ?? [],
            },
          },
        };
      });
      return;
    case 'sensor.progress':
      store.setState((state) => {
        const existing = state.sensors[event.sensorId];
        if (!existing) {
          return state;
        }
        const prevOut = existing.stdout ?? '';
        const stdout = prevOut ? `${prevOut}\n${event.message}` : event.message;
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: {
              ...existing,
              message: event.message,
              stdout,
            },
          },
        };
      });
      return;
    case 'sensor.completed':
      store.setState((state) => {
        const existing = state.sensors[event.sensorId];
        const nextStatus = event.status satisfies TuiSensorStatus;
        const base =
          existing ??
          ({
            sensorId: event.sensorId,
            kind: 'computational',
            status: 'running',
            message: null,
            durationMs: null,
            onFail: null,
            stdout: null,
            stderr: null,
            violations: [],
          } as const);
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: {
              ...base,
              status: nextStatus,
              durationMs: event.durationMs,
            },
          },
        };
      });
      return;
    case 'sensor.failed':
      store.setState((state) => {
        const existing = state.sensors[event.sensorId];
        const base =
          existing ??
          ({
            sensorId: event.sensorId,
            kind: 'computational',
            status: 'error',
            message: null,
            durationMs: null,
            onFail: null,
            stdout: null,
            stderr: null,
            violations: [],
          } as const);
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: {
              ...base,
              status: 'error',
              message: event.error,
              stderr: event.error,
            },
          },
        };
      });
      return;
  }
}

function closePreviousRunningSprints(
  sprints: readonly TuiSprintState[],
  newIdx: number,
): readonly TuiSprintState[] {
  return sprints.map((sprint) => {
    if (sprint.idx < newIdx && sprint.status === 'running') {
      return { ...sprint, status: 'done' };
    }
    return sprint;
  });
}

function upsertSprint(
  sprints: readonly TuiSprintState[],
  next: TuiSprintState,
): readonly TuiSprintState[] {
  const existingIndex = sprints.findIndex((sprint) => sprint.idx === next.idx);
  if (existingIndex === -1) {
    return [...sprints, next].sort((a, b) => a.idx - b.idx);
  }
  const copy = sprints.slice();
  const existing = copy[existingIndex];
  if (existing) {
    copy[existingIndex] = { ...existing, ...next };
  }
  return copy;
}
