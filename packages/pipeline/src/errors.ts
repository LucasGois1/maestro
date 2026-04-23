import type { PipelineStageName } from '@maestro/core';
import type {
  EscalationSource,
  PipelineFailureAt,
  ResumeTarget,
} from '@maestro/state';

export class PipelinePauseError extends Error {
  constructor(
    message: string,
    public readonly at: PipelineStageName,
  ) {
    super(message);
    this.name = 'PipelinePauseError';
  }
}

export class PipelineEscalationError extends Error {
  constructor(
    message: string,
    public readonly sprintIdx: number,
    public readonly reason: string,
    public readonly source: EscalationSource,
    public readonly phaseAtEscalation: PipelineFailureAt,
    public readonly resumeTarget: ResumeTarget,
    public readonly artifactHints?: readonly string[],
  ) {
    super(message);
    this.name = 'PipelineEscalationError';
  }
}

export class PipelineRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`No run with id "${runId}"`);
    this.name = 'PipelineRunNotFoundError';
  }
}

export class PipelineResumeNotAllowedError extends Error {
  constructor(runId: string, status: string) {
    super(`Run "${runId}" cannot be resumed (status: ${status})`);
    this.name = 'PipelineResumeNotAllowedError';
  }
}
