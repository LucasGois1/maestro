import type { ResumeTarget, StateStore } from '@maestro/state';

import {
  PipelineResumeNotAllowedError,
  PipelineRunNotFoundError,
} from './errors.js';
import {
  runPipeline,
  type PlannerInterviewResponse,
  type PipelineRunOptions,
  type PipelineRunResult,
} from './engine.js';

export type ResumePipelineOptions = Omit<
  PipelineRunOptions,
  'prompt' | 'branch' | 'worktreePath' | 'runId' | 'resume'
> & {
  readonly runId?: string;
  readonly humanFeedback?: string;
  readonly plannerInterviewResponse?: PlannerInterviewResponse;
  readonly resumeTargetOverride?: ResumeTarget;
};

export async function resumePipeline(
  options: ResumePipelineOptions,
): Promise<PipelineRunResult> {
  const store: StateStore = options.store;
  const target =
    options.runId !== undefined
      ? await store.load(options.runId)
      : await store.latestResumable();

  if (!target) {
    throw new PipelineRunNotFoundError(options.runId ?? '(latest)');
  }

  if (target.status === 'completed' || target.status === 'canceled') {
    throw new PipelineResumeNotAllowedError(target.runId, target.status);
  }

  return runPipeline({
    ...options,
    runId: target.runId,
    prompt: target.metadata.prompt,
    branch: target.branch,
    worktreePath: target.worktreePath,
    resume: true,
    ...(options.humanFeedback !== undefined
      ? { humanFeedback: options.humanFeedback }
      : {}),
    ...(options.plannerInterviewResponse !== undefined
      ? { plannerInterviewResponse: options.plannerInterviewResponse }
      : {}),
    ...(options.resumeTargetOverride !== undefined
      ? { resumeTargetOverride: options.resumeTargetOverride }
      : {}),
  });
}
