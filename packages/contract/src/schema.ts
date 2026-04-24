import { z } from 'zod';

export const CONTRACT_STATUSES = [
  'proposed',
  'negotiating',
  'agreed',
  'in_progress',
  'done',
  'failed',
] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const NEGOTIATION_ROLES = [
  'architect',
  'generator',
  'evaluator',
  'human',
] as const;

export type NegotiationRole = (typeof NEGOTIATION_ROLES)[number];

export const MAX_NEGOTIATION_ROUNDS = 3;

const filePathSchema = z
  .string()
  .min(1)
  .regex(/^[^\0]+$/u, 'Invalid file path');

const scopeSchema = z
  .object({
    files_expected: z.array(filePathSchema).default([]),
    files_may_touch: z.array(filePathSchema).default([]),
  })
  .strict();

const acceptanceCriterionSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    verifier: z.string().min(1),
  })
  .strict();

export const sprintContractFrontmatterSchema = z
  .object({
    sprint: z.number().int().positive(),
    feature: z.string().min(1),
    depends_on: z.array(z.number().int().positive()).default([]),
    status: z.enum(CONTRACT_STATUSES),
    scope: scopeSchema.prefault({}),
    acceptance_criteria: z.array(acceptanceCriterionSchema).min(1),
    negotiated_by: z.array(z.enum(NEGOTIATION_ROLES)).default([]),
    iterations: z.number().int().nonnegative().default(0),
  })
  .strict();

export type SprintContractFrontmatterInput = z.input<
  typeof sprintContractFrontmatterSchema
>;

export type SprintContractFrontmatter = z.output<
  typeof sprintContractFrontmatterSchema
>;

export type SprintContract = {
  readonly frontmatter: SprintContractFrontmatter;
  readonly body: string;
};
