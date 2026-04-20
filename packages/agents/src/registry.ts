import type { AgentDefinition, AnyAgentDefinition } from './definition.js';

export class AgentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentRegistryError';
  }
}

export interface AgentRegistry {
  register(def: AnyAgentDefinition): void;
  get(id: string): AnyAgentDefinition | undefined;
  require(id: string): AnyAgentDefinition;
  list(): AnyAgentDefinition[];
  pipeline(): AnyAgentDefinition[];
  sensors(): AnyAgentDefinition[];
  background(): AnyAgentDefinition[];
  has(id: string): boolean;
  snapshot(): ReadonlyMap<string, AnyAgentDefinition>;
}

export function createAgentRegistry(): AgentRegistry {
  const defs = new Map<string, AnyAgentDefinition>();

  function validatePipeline(): void {
    const pipeline = [...defs.values()].filter((d) => d.role === 'pipeline');
    for (const d of pipeline) {
      if (d.stage === undefined) {
        throw new AgentRegistryError(
          `Pipeline agent "${d.id}" must declare a stage (1–5).`,
        );
      }
    }
    const stages = pipeline.flatMap((d) =>
      typeof d.stage === 'number' ? [d.stage] : [],
    );
    const seen = new Set<number>();
    for (const stage of stages) {
      if (seen.has(stage)) {
        const clash = pipeline
          .filter((d) => d.stage === stage)
          .map((d) => d.id);
        throw new AgentRegistryError(
          `Duplicate pipeline stage ${stage} across agents: ${clash.join(', ')}`,
        );
      }
      seen.add(stage);
    }
  }

  function validateRole(def: AnyAgentDefinition): void {
    if (def.role !== 'pipeline' && def.stage !== undefined) {
      throw new AgentRegistryError(
        `Agent "${def.id}" has role "${def.role}" and must not declare a stage.`,
      );
    }
  }

  return {
    register(def) {
      validateRole(def);
      defs.set(def.id, def);
      try {
        validatePipeline();
      } catch (error) {
        defs.delete(def.id);
        throw error;
      }
    },
    get(id) {
      return defs.get(id);
    },
    require(id) {
      const def = defs.get(id);
      if (!def) throw new AgentRegistryError(`Agent not registered: ${id}`);
      return def;
    },
    list() {
      return [...defs.values()];
    },
    pipeline() {
      return [...defs.values()]
        .filter(
          (d): d is AgentDefinition & { stage: number } =>
            d.role === 'pipeline' && typeof d.stage === 'number',
        )
        .sort((a, b) => a.stage - b.stage);
    },
    sensors() {
      return [...defs.values()].filter((d) => d.role === 'sensor');
    },
    background() {
      return [...defs.values()].filter((d) => d.role === 'background');
    },
    has(id) {
      return defs.has(id);
    },
    snapshot() {
      return new Map(defs);
    },
  };
}
