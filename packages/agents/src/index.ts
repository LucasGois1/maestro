import { BUILT_IN_AGENTS } from './built-in.js';
import type { AnyAgentDefinition } from './definition.js';

export const AGENTS_PACKAGE_NAME = '@maestro/agents';

export {
  AGENT_ROLES,
  PIPELINE_STAGES,
  type AgentCalibration,
  type AgentContext,
  type AgentDefinition,
  type AgentRole,
  type AnyAgentDefinition,
  type Criterion,
  type FewShotExample,
  type PipelineStage,
  type SystemPromptResolver,
  type ToolRef,
} from './definition.js';

export {
  AgentRegistryError,
  createAgentRegistry,
  type AgentRegistry,
} from './registry.js';

export {
  AgentOutputParseError,
  AgentValidationError,
  formatAgentErrorForDisplay,
  runAgent,
  type RunAgentOptions,
  type RunAgentResult,
} from './runner.js';

export {
  createBusShellApprovalPrompter,
  type BusShellApprovalPrompter,
} from './bus-shell-approval-prompter.js';

export { AgentLoaderError, loadCustomAgents } from './loader.js';

export {
  architectAgent,
  BUILT_IN_AGENTS,
  codeReviewerAgent,
  discoveryAgent,
  docGardenerAgent,
  evaluatorAgent,
  generatorAgent,
  mergerAgent,
  plannerAgent,
} from './built-in.js';
export { sensorSetupAgent } from './sensor-setup/sensor-setup-agent.js';
export {
  sensorSetupAgentInputSchema,
  sensorSetupAgentOutputSchema,
  type SensorSetupAgentInput,
  type SensorSetupAgentOutput,
  type SensorSetupCandidate,
} from './sensor-setup/sensor-setup-schemas.js';

export {
  ARCHITECT_FEW_SHOT_EXAMPLES,
  resolvedArchitectSystemPrompt,
} from './architect/calibration.js';
export { ARCHITECT_SYSTEM_PROMPT } from './architect/system-prompt.js';
export {
  architectModelOutputSchema,
  finalizeArchitectOutput,
  type ArchitectModelOutput,
  type ArchitectPipelineResult,
} from './architect/architect-output.schema.js';
export {
  architectNotesForPlanEmbed,
  renderArchitectNotesMarkdown,
} from './architect/format-notes.js';
export {
  PLANNER_FEW_SHOT_EXAMPLES,
  resolvedPlannerSystemPrompt,
} from './planner/calibration.js';
export { PLANNER_SYSTEM_PROMPT } from './planner/system-prompt.js';
export {
  createArchitectToolSet,
  createPlannerToolSet,
  createSensorSetupToolSet,
  summarizeDependencies,
} from './repo-tools.js';
export {
  createGeneratorToolSet,
  type GeneratorToolContext,
  type GeneratorToolHooks,
} from './generator-tools.js';
export {
  GENERATOR_FEW_SHOT_EXAMPLES,
  resolvedGeneratorSystemPrompt,
} from './generator/calibration.js';
export { GENERATOR_SYSTEM_PROMPT } from './generator/system-prompt.js';
export {
  generatorInputSchema,
  type GeneratorInput,
} from './generator/generator-input.schema.js';
export {
  generatorModelOutputSchema,
  type GeneratorModelOutput,
} from './generator/generator-output.schema.js';
export {
  EVALUATOR_FEW_SHOT_EXAMPLES,
  resolvedEvaluatorSystemPrompt,
} from './evaluator/calibration.js';
export { EVALUATOR_SYSTEM_PROMPT } from './evaluator/system-prompt.js';
export {
  evaluatorInputSchema,
  type EvaluatorInput,
} from './evaluator/evaluator-input.schema.js';
export {
  evaluatorFailuresForGenerator,
  evaluatorModelOutputSchema,
  evaluatorPassFromDecision,
  type EvaluatorDecision,
  type EvaluatorModelOutput,
} from './evaluator/evaluator-output.schema.js';
export {
  MERGER_FEW_SHOT_EXAMPLES,
  resolvedMergerSystemPrompt,
} from './merger/calibration.js';
export { inferLabelsFromPaths } from './merger/infer-labels.js';
export {
  mergerInputSchema,
  type MergerInput,
  type MergerSprintOutcomeSummary,
} from './merger/merger-input.schema.js';
export {
  mergerModelOutputSchema,
  mergerRunStatusSchema,
  type MergerModelOutput,
  type MergerRunStatus,
} from './merger/merger-output.schema.js';
export { MERGER_SYSTEM_PROMPT } from './merger/system-prompt.js';
export {
  createMergerToolSet,
  type MergerToolContext,
  type MergerToolHooks,
} from './merger-tools.js';
export {
  DOC_GARDENER_FEW_SHOT_EXAMPLES,
  resolvedDocGardenerSystemPrompt,
} from './doc-gardener/calibration.js';
export {
  executeBackgroundGardener,
  type ExecuteBackgroundOptions,
  type ExecuteBackgroundResult,
} from './doc-gardener/execute-background.js';
export {
  analyzeDuplicateSourceFiles,
  detectCodeDriftHeuristic,
} from './doc-gardener/detect-code-drift.js';
export { detectStaleDocumentation } from './doc-gardener/detect-stale-docs.js';
export {
  gardenerInputSchema,
  gardenerRunTypeSchema,
  type GardenerInput,
} from './doc-gardener/gardener-input.schema.js';
export {
  gardenerBreakdownSchema,
  gardenerOutputSchema,
  type GardenerBreakdown,
  type GardenerOutput,
  type GardenerPrOpened,
} from './doc-gardener/gardener-output.schema.js';
export {
  isWorkingTreeClean,
  resolveDefaultBranch,
} from './doc-gardener/background-git.js';
export {
  detectKnipIssues,
  detectPnpmOutdated,
  parseKnipReporterJson,
  parsePnpmOutdatedText,
  type PackageHealthFinding,
} from './doc-gardener/detect-package-health.js';
export {
  mergeOpenPrDeps,
  openPrForCategory,
  type OpenPrDeps,
} from './doc-gardener/open-pr-category.js';
export { DOC_GARDENER_SYSTEM_PROMPT } from './doc-gardener/system-prompt.js';
export {
  createGardenerToolSet,
  type GardenerToolContext,
} from './gardener-tools.js';
export {
  CODE_REVIEWER_FEW_SHOT_EXAMPLES,
  resolvedCodeReviewerSystemPrompt,
} from './code-reviewer/calibration.js';
export {
  codeReviewInputSchema,
  type CodeReviewInput,
} from './code-reviewer/code-review-input.schema.js';
export {
  codeReviewOutputSchema,
  codeReviewViolationCategorySchema,
  codeReviewViolationSchema,
  codeReviewViolationSeveritySchema,
  type CodeReviewOutput,
  type CodeReviewViolation,
} from '@maestro/sensors';
export { CODE_REVIEWER_SYSTEM_PROMPT } from './code-reviewer/system-prompt.js';
export {
  createEvaluatorToolSet,
  type EvaluatorToolContext,
  type EvaluatorToolHooks,
} from './evaluator-tools.js';
export {
  isPlannerEscalation,
  plannerModelOutputSchema,
  plannerSprintRawSchema,
  userStorySchema,
  type PlannerModelOutput,
  type PlannerSprintRaw,
  type UserStory,
} from './planner/plan-output.schema.js';
export {
  plannerInputSchema,
  plannerReplanContextSchema,
  type PlannerInput,
  type PlannerReplanContext,
} from './planner/planner-input.schema.js';
export {
  normalizePlannerModelOutput,
  type PlannerOutput,
  type PlannerPipelineSprint,
} from './planner/normalize.js';
export {
  plannerOutputSnapshotSchema,
  type PlannerOutputSnapshot,
} from './planner/planner-output-snapshot.schema.js';

export function registerBuiltInAgents(registry: {
  register(def: AnyAgentDefinition): void;
}): void {
  for (const def of BUILT_IN_AGENTS) {
    registry.register(def);
  }
}
