import type { PipelineStageName } from '@maestro/core';

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
