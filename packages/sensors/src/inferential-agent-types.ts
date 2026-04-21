/**
 * Subconjunto structural dos tipos de @maestro/agents usados pelo runner de sensores.
 * Evita `import type` de `@maestro/agents` para não criar ciclo de build DTS com esse pacote.
 */
export type InferentialAgentContext = {
  readonly agentId: string;
  readonly runId: string;
  readonly workingDir: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type InferentialAnyAgentDefinition = {
  readonly id: string;
  readonly [key: string]: unknown;
};

export type InferentialAgentRegistry = {
  readonly get: (id: string) => InferentialAnyAgentDefinition | undefined;
};
