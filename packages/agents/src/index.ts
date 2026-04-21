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

export function registerBuiltInAgents(registry: {
  register(def: AnyAgentDefinition): void;
}): void {
  for (const def of BUILT_IN_AGENTS) {
    registry.register(def);
  }
}
