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
  summarizeDependencies,
} from './repo-tools.js';
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
  normalizePlannerModelOutput,
  type PlannerOutput,
  type PlannerPipelineSprint,
} from './planner/normalize.js';

export function registerBuiltInAgents(registry: {
  register(def: AnyAgentDefinition): void;
}): void {
  for (const def of BUILT_IN_AGENTS) {
    registry.register(def);
  }
}
