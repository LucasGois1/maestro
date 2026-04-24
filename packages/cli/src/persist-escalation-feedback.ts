import type { EventBus } from '@maestro/core';
import { loadConfigWithAutoResolvedModels } from '@maestro/provider';
import {
  type PlannerInterviewResponse,
  PipelineEscalationError,
  PipelinePauseError,
  resumePipeline,
  type ResumePipelineOptions,
} from '@maestro/pipeline';
import type { StateStore } from '@maestro/state';
import type {
  PlanningInterviewSubmission,
  TuiStore,
} from '@maestro/tui';

import { formatCliError } from './format-cli-error.js';

export type PersistEscalationFeedbackResult = {
  readonly ok: boolean;
  readonly message: string;
};

export type PersistPlanningInterviewResponseResult = {
  readonly ok: boolean;
  readonly message: string;
};

export type ResumeAfterPersistDeps = {
  readonly repoRoot: string;
  readonly bus: EventBus;
  readonly loadConfig: typeof loadConfigWithAutoResolvedModels;
};

export function createPersistEscalationHumanFeedback(options: {
  readonly stateStore: StateStore;
  readonly tuiStore: TuiStore;
  readonly resumeAfterPersist?: ResumeAfterPersistDeps;
  /**
   * Test seam: defaults to `resumePipeline` from `@maestro/pipeline`.
   */
  readonly resumePipelineFn?: (
    opts: ResumePipelineOptions,
  ) => Promise<unknown>;
}): (text: string) => Promise<PersistEscalationFeedbackResult> {
  const impl = options.resumePipelineFn ?? resumePipeline;

  return async (text: string) => {
    const runId = options.tuiStore.getState().runId;
    if (runId === null) {
      return { ok: false, message: 'Sem runId ativo na TUI.' };
    }
    const st = await options.stateStore.load(runId);
    if (st?.escalation === undefined) {
      return {
        ok: false,
        message:
          'Sem escalação persistida nesta run (estado pode ter sido limpo).',
      };
    }
    await options.stateStore.update(runId, {
      escalation: {
        ...st.escalation,
        humanFeedback: {
          text,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    if (options.resumeAfterPersist !== undefined) {
      const { repoRoot, bus, loadConfig } = options.resumeAfterPersist;
      void impl({
        runId,
        repoRoot,
        store: options.stateStore,
        bus,
        config: (await loadConfig({ cwd: repoRoot })).resolved,
      }).catch((error: unknown) => {
        if (
          error instanceof PipelineEscalationError ||
          error instanceof PipelinePauseError
        ) {
          return;
        }
        bus.emit({
          type: 'pipeline.failed',
          runId,
          at: 'planning',
          error: formatCliError(error),
        });
      });
      return {
        ok: true,
        message: 'Feedback gravado; a retomar o pipeline…',
      };
    }

    return {
      ok: true,
      message:
        'Feedback gravado. Retoma manualmente com /resume se estiveres neste modo.',
    };
  };
}

function toPlannerInterviewResponse(
  submission: PlanningInterviewSubmission,
): PlannerInterviewResponse {
  switch (submission.kind) {
    case 'answers':
      return {
        kind: 'answers',
        answers: submission.answers.map((answer) => ({
          questionId: answer.questionId,
          answer: answer.answer,
        })),
      };
    case 'continue_gate':
      return {
        kind: 'continue_gate',
        decision: submission.decision,
      };
    case 'summary_review':
      return {
        kind: 'summary_review',
        feedback: submission.feedback,
      };
  }
}

export function createPersistPlanningInterviewResponse(options: {
  readonly stateStore: StateStore;
  readonly tuiStore: TuiStore;
  readonly resumeAfterPersist?: ResumeAfterPersistDeps;
  readonly resumePipelineFn?: (
    opts: ResumePipelineOptions,
  ) => Promise<unknown>;
}): (
  submission: PlanningInterviewSubmission,
) => Promise<PersistPlanningInterviewResponseResult> {
  const impl = options.resumePipelineFn ?? resumePipeline;

  return async (submission) => {
    const runId = options.tuiStore.getState().runId;
    if (runId === null) {
      return { ok: false, message: 'Sem runId ativo na TUI.' };
    }
    const st = await options.stateStore.load(runId);
    if (st?.planningInterview === undefined) {
      return {
        ok: false,
        message:
          'Sem entrevista do Planner pendente nesta run (estado pode ter mudado).',
      };
    }

    if (options.resumeAfterPersist !== undefined) {
      const { repoRoot, bus, loadConfig } = options.resumeAfterPersist;
      void impl({
        runId,
        repoRoot,
        store: options.stateStore,
        bus,
        config: (await loadConfig({ cwd: repoRoot })).resolved,
        plannerInterviewResponse: toPlannerInterviewResponse(submission),
      }).catch((error: unknown) => {
        if (
          error instanceof PipelineEscalationError ||
          error instanceof PipelinePauseError
        ) {
          return;
        }
        bus.emit({
          type: 'pipeline.failed',
          runId,
          at: 'planning',
          error: formatCliError(error),
        });
      });
      return {
        ok: true,
        message: 'Resposta gravada; a retomar a entrevista/plano…',
      };
    }

    return {
      ok: true,
      message:
        'Resposta recebida. Retoma manualmente com /resume se estiveres neste modo.',
    };
  };
}
