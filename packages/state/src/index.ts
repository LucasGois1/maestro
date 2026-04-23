export const STATE_PACKAGE_NAME = '@maestro/state';

export {
  PIPELINE_FAILURE_AT,
  PIPELINE_STAGES,
  RUN_STATUSES,
  pipelineFailureAtSchema,
  runFailureSchema,
  runMetaSchema,
  runStateSchema,
  type PipelineFailureAt,
  type PipelineStage,
  type RunFailure,
  type RunMeta,
  type RunState,
  type RunStateInput,
  type RunStatus,
} from './schema.js';

export {
  CHECKPOINTS_DIR,
  CONTRACTS_DIR,
  completedExecPlanRelativePath,
  EXEC_PLANS_RELATIVE_SEGMENTS,
  FEEDBACK_DIR,
  LOGS_DIR,
  MAESTRO_DIR,
  META_FILE,
  PLAN_FILE,
  PLAN_SNAPSHOT_FILE,
  PROJECT_LOG_FILE,
  RUNS_DIR,
  STATE_FILE,
  execPlansActiveDir,
  execPlansCompletedDir,
  feedbackPath,
  handoffPath,
  selfEvalPath,
  maestroRoot,
  projectLogPath,
  runCheckpointsDir,
  runContractsDir,
  runFeedbackDir,
  runLogsDir,
  runMetaPath,
  runPlanPath,
  runPlanSnapshotPath,
  sprintOutcomeCheckpointPath,
  runRoot,
  runStatePath,
  runsRoot,
  type RunPathOptions,
} from './paths.js';

export { writeAtomic, writeAtomicJson } from './atomic.js';

export {
  createStateStore,
  StateStoreError,
  type CreateRunOptions,
  type CreateStateStoreOptions,
  type StateStore,
} from './store.js';

export {
  renderHandoffMarkdown,
  writeHandoff,
  type HandoffArtifact,
  type WriteHandoffOptions,
} from './handoff.js';
export {
  renderSelfEvalMarkdown,
  writeSprintSelfEval,
  type SprintSelfEvalPayload,
  type WriteSprintSelfEvalOptions,
} from './self-eval.js';

export {
  appendProjectLog,
  readProjectLog,
  type AppendProjectLogOptions,
  type ProjectLogEntry,
  type ProjectLogLevel,
} from './project-log.js';

export {
  writeCompletedExecPlan,
  type WriteCompletedExecPlanOptions,
} from './exec-plan.js';
