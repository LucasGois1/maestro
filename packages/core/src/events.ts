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

export type AgentEventType = AgentEvent['type'];

export type AgentEventListener = (event: AgentEvent) => void;

export interface EventBus {
  emit(event: AgentEvent): void;
  on(listener: AgentEventListener): () => void;
}

export function createEventBus(): EventBus {
  const listeners = new Set<AgentEventListener>();
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
