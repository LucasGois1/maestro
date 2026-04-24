export const PIPELINE_PACKAGE_NAME = '@maestro/pipeline';

export {
  contractScopeFromArchitect,
  DEFAULT_MAX_PLAN_REPLANS,
  DEFAULT_RETRIES,
  runPipeline,
  type EvaluatorModelOutput,
  type MergerModelOutput,
  type PlannerInterviewResponse,
  type PipelineRunOptions,
  type PipelineRunResult,
  type PlannerOutput,
} from './engine.js';

export { resumePipeline, type ResumePipelineOptions } from './resume.js';

export { defaultAgentExecutor, type AgentExecutor } from './executor.js';

export {
  PipelineEscalationError,
  PipelinePauseError,
  PipelineResumeNotAllowedError,
  PipelineRunNotFoundError,
} from './errors.js';
