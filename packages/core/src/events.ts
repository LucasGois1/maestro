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

/** Alinhado com `EscalationSource` em `@maestro/state` (eventos não dependem desse pacote). */
export type PipelineEscalationSource =
  | 'architect'
  | 'evaluator'
  | 'planner'
  | 'pipeline';

/** Alinhado com `ResumeTarget` em `@maestro/state`. */
export type PipelineResumeTarget =
  | 'ContinueGenerate'
  | 'ReSeedContract'
  | 'ReArchitectAndContract'
  | 'ReplanOnly';

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
      readonly source?: PipelineEscalationSource;
      readonly phaseAtEscalation?: PipelineStageName;
      readonly resumeTarget?: PipelineResumeTarget;
      readonly artifactHints?: readonly string[];
    }
  | {
      readonly type: 'pipeline.escalation_pending';
      readonly runId: string;
      readonly sprintIdx: number;
      readonly reason: string;
      readonly source: PipelineEscalationSource;
      readonly phaseAtEscalation: PipelineStageName;
      readonly resumeTarget: PipelineResumeTarget;
      readonly artifactHints?: readonly string[];
    }
  | {
      readonly type: 'pipeline.plan_revised';
      readonly runId: string;
      /** 1-based replan attempt within this pipeline run. */
      readonly attempt: number;
      /** Short human-readable summary (e.g. truncated Architect reason). */
      readonly reasonSummary: string;
    }
  | {
      readonly type: 'pipeline.paused';
      readonly runId: string;
      readonly at: PipelineStageName;
    }
  | {
      readonly type: 'pipeline.resumed';
      readonly runId: string;
      /** Fase persistida; inclui `escalated` quando a run estava em escalação humana. */
      readonly from: PipelineStageName | 'escalated';
      /** Quando `from === 'escalated'`, fase operacional antes da pausa (ex.: `evaluating`). */
      readonly phaseBeforeEscalation?: PipelineStageName;
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

export type SensorEvent =
  | {
      readonly type: 'sensor.registered';
      readonly sensorId: string;
      readonly runId: string;
      readonly kind: 'computational' | 'inferential';
      readonly onFail: 'block' | 'warn';
    }
  | {
      readonly type: 'sensor.started';
      readonly sensorId: string;
      readonly runId: string;
      readonly kind: 'computational' | 'inferential';
      readonly onFail?: 'block' | 'warn';
    }
  | {
      readonly type: 'sensor.progress';
      readonly sensorId: string;
      readonly runId: string;
      readonly message: string;
    }
  | {
      readonly type: 'sensor.completed';
      readonly sensorId: string;
      readonly runId: string;
      readonly status:
        | 'passed'
        | 'failed'
        | 'warned'
        | 'skipped'
        | 'timeout'
        | 'error';
      readonly durationMs: number;
    }
  | {
      readonly type: 'sensor.failed';
      readonly sensorId: string;
      readonly runId: string;
      readonly error: string;
    };

/** Emitted by tooling / pipeline to drive the contextual diff · preview · feedback slot in the TUI. */
export type ContextEvent =
  | {
      readonly type: 'artifact.diff_updated';
      readonly runId: string;
      readonly activePath: string;
      readonly unifiedDiff: string;
      readonly changedPaths: readonly string[];
      readonly activeIndex: number;
    }
  | {
      readonly type: 'evaluator.feedback';
      readonly runId: string;
      readonly criterion: string;
      readonly failure: string;
      readonly file?: string;
      readonly line?: number;
      readonly suggestedAction?: string;
      /** Sprint index when feedback was produced (optional; TUI falls back to pipeline state). */
      readonly sprintIdx?: number;
      /** Evaluation attempt within the sprint (optional; TUI auto-increments per run/sprint). */
      readonly attempt?: number;
    }
  | {
      readonly type: 'kb.file_read';
      readonly runId: string;
      /** Path relative to repo root or normalized key used for KB highlight. */
      readonly path: string;
    };

export type MaestroEvent =
  | AgentEvent
  | PipelineEvent
  | SensorEvent
  | ContextEvent;

export type AgentEventType = AgentEvent['type'];
export type PipelineEventType = PipelineEvent['type'];
export type SensorEventType = SensorEvent['type'];
export type ContextEventType = ContextEvent['type'];
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
