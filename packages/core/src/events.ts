export type AgentEvent =
  | {
      readonly type: 'agent.started';
      readonly agentId: string;
      readonly runId: string;
    }
  | {
      readonly type: 'agent.delta';
      readonly agentId: string;
      readonly runId: string;
      readonly chunk: string;
    }
  | {
      readonly type: 'agent.tool_call';
      readonly agentId: string;
      readonly runId: string;
      readonly tool: string;
      readonly args: unknown;
    }
  | {
      readonly type: 'agent.tool_result';
      readonly agentId: string;
      readonly runId: string;
      readonly tool: string;
      readonly result: unknown;
    }
  | {
      readonly type: 'agent.decision';
      readonly agentId: string;
      readonly runId: string;
      readonly message: string;
    }
  | {
      readonly type: 'agent.completed';
      readonly agentId: string;
      readonly runId: string;
      readonly output: unknown;
      readonly durationMs: number;
    }
  | {
      readonly type: 'agent.failed';
      readonly agentId: string;
      readonly runId: string;
      readonly error: string;
    };

export type PipelineStageName =
  | 'discovering'
  | 'planning'
  | 'architecting'
  | 'contracting'
  | 'generating'
  | 'evaluating'
  | 'merging';

export type PipelineEvent =
  | { readonly type: 'pipeline.started'; readonly runId: string }
  | {
      readonly type: 'pipeline.stage_entered';
      readonly runId: string;
      readonly stage: PipelineStageName;
      readonly sprintIdx?: number;
    }
  | {
      readonly type: 'pipeline.sprint_started';
      readonly runId: string;
      readonly sprintIdx: number;
      readonly totalSprints: number;
    }
  | {
      readonly type: 'pipeline.sprint_retried';
      readonly runId: string;
      readonly sprintIdx: number;
      readonly retry: number;
    }
  | {
      readonly type: 'pipeline.sprint_escalated';
      readonly runId: string;
      readonly sprintIdx: number;
      readonly reason: string;
    }
  | {
      readonly type: 'pipeline.paused';
      readonly runId: string;
      readonly at: PipelineStageName;
    }
  | {
      readonly type: 'pipeline.resumed';
      readonly runId: string;
      readonly from: PipelineStageName;
    }
  | {
      readonly type: 'pipeline.completed';
      readonly runId: string;
      readonly durationMs: number;
    }
  | {
      readonly type: 'pipeline.failed';
      readonly runId: string;
      readonly error: string;
      readonly at: PipelineStageName;
    };

export type MaestroEvent = AgentEvent | PipelineEvent;

export type AgentEventType = AgentEvent['type'];
export type PipelineEventType = PipelineEvent['type'];
export type MaestroEventType = MaestroEvent['type'];

export type AgentEventListener = (event: AgentEvent) => void;
export type MaestroEventListener = (event: MaestroEvent) => void;

export interface EventBus {
  emit(event: MaestroEvent): void;
  on(listener: MaestroEventListener): () => void;
}

export function createEventBus(): EventBus {
  const listeners = new Set<MaestroEventListener>();
  return {
    emit(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // listener errors must not break producers
        }
      }
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
