/**
 * Superfície mínima para `import('@maestro/agents')` dinâmico no runner.
 * Evita depender de `dist/index.d.ts` de agents durante o DTS de sensors (build paralelo).
 */
declare module '@maestro/agents' {
  export const codeReviewerAgent: {
    readonly id: string;
    readonly [key: string]: unknown;
  };

  export function runAgent(
    options: unknown,
  ): Promise<{
    readonly output: unknown;
    readonly text: string;
    readonly durationMs: number;
  }>;

  /** Usado em testes; alinhar com `createAgentRegistry` real em runtime. */
  export function createAgentRegistry(): {
    readonly register: (def: unknown) => void;
    readonly get: (
      id: string,
    ) => { readonly id: string; readonly [key: string]: unknown } | undefined;
    readonly require: (id: string) => unknown;
    readonly list: () => unknown[];
    readonly pipeline: () => unknown[];
    readonly sensors: () => unknown[];
    readonly background: () => unknown[];
    readonly has: (id: string) => boolean;
    readonly snapshot: () => ReadonlyMap<string, unknown>;
  };
}
