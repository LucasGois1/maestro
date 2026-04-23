import { z } from 'zod';

export const AGENT_NAMES = [
  'planner',
  'architect',
  'generator',
  'evaluator',
  'merger',
  'code-reviewer',
  'doc-gardener',
  'discovery',
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export const PROVIDER_NAMES = [
  'anthropic',
  'openai',
  'google',
  'ollama',
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const PERMISSION_MODES = ['strict', 'allowlist', 'yolo'] as const;

export type PermissionMode = (typeof PERMISSION_MODES)[number];

export const BRANCHING_STRATEGIES = ['conventional', 'custom', 'ask'] as const;

export type BranchingStrategy = (typeof BRANCHING_STRATEGIES)[number];

const apiProviderSchema = z
  .object({
    apiKey: z.string().min(1).optional(),
  })
  .strict();

const ollamaProviderSchema = z
  .object({
    baseUrl: z.url().default('http://localhost:11434'),
  })
  .strict();

const providersSchema = z
  .object({
    anthropic: apiProviderSchema.prefault({}),
    openai: apiProviderSchema.prefault({}),
    google: apiProviderSchema.prefault({}),
    ollama: ollamaProviderSchema.prefault({}),
  })
  .strict();

const agentDefaultSchema = z
  .object({
    model: z.string().min(1),
  })
  .strict();

const defaultsSchema = z
  .object({
    planner: agentDefaultSchema.prefault({
      model: 'anthropic/claude-sonnet-4-6',
    }),
    architect: agentDefaultSchema.prefault({
      model: 'anthropic/claude-sonnet-4-6',
    }),
    generator: agentDefaultSchema.prefault({
      model: 'anthropic/claude-opus-4-7',
    }),
    evaluator: agentDefaultSchema.prefault({
      model: 'anthropic/claude-opus-4-7',
    }),
    merger: agentDefaultSchema.prefault({
      model: 'anthropic/claude-haiku-4-5',
    }),
    'code-reviewer': agentDefaultSchema.prefault({
      model: 'anthropic/claude-sonnet-4-6',
    }),
    'doc-gardener': agentDefaultSchema.prefault({
      model: 'anthropic/claude-haiku-4-5',
    }),
    discovery: agentDefaultSchema.prefault({
      model: 'anthropic/claude-sonnet-4-6',
    }),
    'sensor-setup': agentDefaultSchema.prefault({
      model: 'anthropic/claude-sonnet-4-6',
    }),
  })
  .strict();

const permissionsSchema = z
  .object({
    mode: z.enum(PERMISSION_MODES).default('allowlist'),
    allowlist: z.array(z.string().min(1)).default([]),
    denylist: z.array(z.string().min(1)).default([]),
  })
  .strict();

const branchingSchema = z
  .object({
    strategy: z.enum(BRANCHING_STRATEGIES).default('conventional'),
    prefix: z.string().default('maestro/'),
  })
  .strict();

const discoverySchema = z
  .object({
    enabled: z.boolean().default(true),
    autoUpdateAgentsMd: z.boolean().default(true),
    initBranch: z.string().min(1).default('maestro/init'),
  })
  .strict();

const mergerSchema = z
  .object({
    removeWorktreeOnSuccess: z.boolean().default(false),
    coAuthoredByLine: z.string().optional(),
    requireDraftPr: z.boolean().default(false),
  })
  .strict();

/** Opções do agente Doc Gardener / `maestro background run`. */
const backgroundSchema = z
  .object({
    knip: z.boolean().default(true),
    outdated: z.boolean().default(true),
    maxFindingsPerSource: z.number().int().min(1).max(500).default(80),
  })
  .strict();

export const configSchema = z
  .object({
    version: z.literal(1).default(1),
    providers: providersSchema.prefault({}),
    defaults: defaultsSchema.prefault({}),
    permissions: permissionsSchema.prefault({}),
    branching: branchingSchema.prefault({}),
    discovery: discoverySchema.prefault({}),
    merger: mergerSchema.prefault({}),
    background: backgroundSchema.prefault({}),
  })
  .strict();

export type MaestroConfigInput = z.input<typeof configSchema>;
export type MaestroConfig = z.output<typeof configSchema>;
export type BackgroundConfig = z.infer<typeof backgroundSchema>;

export const DEFAULT_CONFIG: MaestroConfig = configSchema.parse({});
