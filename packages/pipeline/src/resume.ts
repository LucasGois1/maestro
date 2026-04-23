import type { StateStore } from '@maestro/state';

import { PipelineRunNotFoundError } from './errors.js';
import {
  runPipeline,
  type PipelineRunOptions,
  type PipelineRunResult,
} from './engine.js';

export type ResumePipelineOptions = Omit<
  PipelineRunOptions,
  'prompt' | 'branch' | 'worktreePath' | 'runId' | 'resume'
> & {
  readonly runId?: string;
};

export async function resumePipeline(
  options: ResumePipelineOptions,
): Promise<PipelineRunResult> {
  const store: StateStore = options.store;
  const target =
    options.runId !== undefined
      ? await store.load(options.runId)
      : await store.latestStarted();

  if (!target) {
    throw new PipelineRunNotFoundError(options.runId ?? '(latest)');
  }

  return runPipeline({
    ...options,
    runId: target.runId,
    prompt: target.metadata.prompt,
    branch: target.branch,
    worktreePath: target.worktreePath,
    resume: true,
  });
}
