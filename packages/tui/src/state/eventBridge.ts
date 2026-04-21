import type {
  AgentEvent,
  EventBus,
  MaestroEvent,
  PipelineEvent,
  SensorEvent,
} from '@maestro/core';

import type { TuiSensorStatus, TuiSprintState, TuiStore } from './store.js';

export interface BridgeBusOptions {
  readonly agentDeltaBufferChars?: number;
  readonly agentDecisionBufferSize?: number;
  readonly clock?: () => number;
}

const DEFAULT_DELTA_BUFFER_CHARS = 8_000;
const DEFAULT_DECISION_BUFFER_SIZE = 200;

export function bridgeBusToStore(
  bus: EventBus,
  store: TuiStore,
  options: BridgeBusOptions = {},
): () => void {
  const deltaCap = options.agentDeltaBufferChars ?? DEFAULT_DELTA_BUFFER_CHARS;
  const decisionCap =
    options.agentDecisionBufferSize ?? DEFAULT_DECISION_BUFFER_SIZE;
  const clock = options.clock ?? Date.now;

  return bus.on((event) => {
    handleEvent(event, store, { deltaCap, decisionCap, clock });
  });
}

interface InternalConfig {
  readonly deltaCap: number;
  readonly decisionCap: number;
  readonly clock: () => number;
}

function handleEvent(
  event: MaestroEvent,
  store: TuiStore,
  config: InternalConfig,
): void {
  if (isPipelineEvent(event)) {
    handlePipelineEvent(event, store);
    return;
  }
  if (isAgentEvent(event)) {
    handleAgentEvent(event, store, config);
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

function handlePipelineEvent(event: PipelineEvent, store: TuiStore): void {
  switch (event.type) {
    case 'pipeline.started':
      store.setState((state) => ({
        ...state,
        mode: 'run',
        pipeline: {
          ...state.pipeline,
          status: 'running',
          error: null,
          stage: null,
          sprintIdx: null,
          retryCount: 0,
        },
      }));
      return;
    case 'pipeline.stage_entered':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          stage: event.stage,
          sprintIdx: event.sprintIdx ?? state.pipeline.sprintIdx,
        },
        header:
          event.sprintIdx === undefined
            ? state.header
            : { ...state.header, sprintIdx: event.sprintIdx },
      }));
      return;
    case 'pipeline.sprint_started':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          sprintIdx: event.sprintIdx,
          retryCount: 0,
        },
        header: {
          ...state.header,
          sprintIdx: event.sprintIdx,
          totalSprints: event.totalSprints,
        },
        sprints: upsertSprint(state.sprints, {
          idx: event.sprintIdx,
          status: 'running',
          retries: 0,
        }),
      }));
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
    case 'pipeline.paused':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'paused',
          stage: event.at,
        },
      }));
      return;
    case 'pipeline.resumed':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'running',
          stage: event.from,
        },
      }));
      return;
    case 'pipeline.completed':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'completed',
        },
      }));
      return;
    case 'pipeline.failed':
      store.setState((state) => ({
        ...state,
        pipeline: {
          ...state.pipeline,
          status: 'failed',
          stage: event.at,
          error: event.error,
        },
      }));
  }
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
        return {
          ...state,
          agent: { ...state.agent, lastDelta: trimmed },
        };
      });
      return;
    case 'agent.decision':
      store.setState((state) => {
        const decision = {
          agentId: event.agentId,
          message: event.message,
          at: config.clock(),
        };
        const next = [...state.agent.decisions, decision];
        const trimmed =
          next.length > config.decisionCap
            ? next.slice(next.length - config.decisionCap)
            : next;
        return {
          ...state,
          agent: { ...state.agent, decisions: trimmed },
        };
      });
      return;
    case 'agent.tool_call':
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

function handleSensorEvent(event: SensorEvent, store: TuiStore): void {
  switch (event.type) {
    case 'sensor.started':
      store.setState((state) => ({
        ...state,
        sensors: {
          ...state.sensors,
          [event.sensorId]: {
            sensorId: event.sensorId,
            kind: event.kind,
            status: 'running',
            message: null,
          },
        },
      }));
      return;
    case 'sensor.progress':
      store.setState((state) => {
        const existing = state.sensors[event.sensorId];
        if (!existing) {
          return state;
        }
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: { ...existing, message: event.message },
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
          } as const);
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: { ...base, status: nextStatus },
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
          } as const);
        return {
          ...state,
          sensors: {
            ...state.sensors,
            [event.sensorId]: {
              ...base,
              status: 'error',
              message: event.error,
            },
          },
        };
      });
  }
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
  copy[existingIndex] = { ...copy[existingIndex], ...next };
  return copy;
}
