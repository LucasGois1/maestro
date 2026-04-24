export const STATE_PACKAGE_NAME = '@maestro/state';

export {
  ESCALATION_SOURCES,
  RESUME_TARGETS,
  escalationHumanFeedbackSchema,
  escalationSchema,
  escalationSourceSchema,
  planningInterviewAnswerSchema,
  planningInterviewModeSchema,
  planningInterviewQuestionSchema,
  planningInterviewStateSchema,
  PIPELINE_FAILURE_AT,
  PIPELINE_STAGES,
  RUN_STATUSES,
  pipelineFailureAtSchema,
  resumeTargetSchema,
  runFailureSchema,
  runMetaSchema,
  runStateSchema,
  type EscalationHumanFeedback,
  type EscalationSource,
  type PlanningInterviewAnswer,
  type PlanningInterviewMode,
  type PlanningInterviewQuestion,
  type PipelineFailureAt,
  type PipelineStage,
  type ResumeTarget,
  type RunFailure,
  type RunMeta,
  type RunStatePlanningInterview,
  type RunState,
  type RunStateEscalation,
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
  PLANNING_DIR,
  PIPELINE_PROCESS_FILE,
  PROJECT_LOG_FILE,
  RUN_LOG_FILE,
  RUNS_DIR,
  STATE_FILE,
  execPlansActiveDir,
  execPlansCompletedDir,
  feedbackPath,
  handoffPath,
  planningStatePath,
  planningSummaryPath,
  planningTranscriptPath,
  selfEvalPath,
  maestroRoot,
  projectLogPath,
  runCheckpointsDir,
  runContractsDir,
  runFeedbackDir,
  runLogsDir,
  runMetaPath,
  runPlanningDir,
  runPlanPath,
  runPlanSnapshotPath,
  runLogPath,
  runPipelineProcessPath,
  sprintOutcomeCheckpointPath,
  runRoot,
  runStatePath,
  runsRoot,
  type RunPathOptions,
} from './paths.js';

export {
  isProcessAlive,
  isStaleRunningRun,
  readPipelineProcessPid,
  removePipelineProcessMarker,
} from './reconcile-stale-running.js';

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
  appendRunLog,
  type AppendRunLogOptions,
  type RunLogEntry,
  type RunLogLevel,
} from './run-log.js';

export {
  writeCompletedExecPlan,
  type WriteCompletedExecPlanOptions,
} from './exec-plan.js';
