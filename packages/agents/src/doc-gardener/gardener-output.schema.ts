import { z } from 'zod';

import { gardenerRunTypeSchema } from './gardener-input.schema.js';

export const gardenerPrOpenedSchema = z
  .object({
    url: z.string(),
    title: z.string(),
    category: z.string(),
    filesChanged: z.number().int().nonnegative(),
  })
  .strict();

/** Contagens por fonte; `issuesFound` = max(soma heurísticas, llmReported). */
export const gardenerBreakdownSchema = z
  .object({
    docHygiene: z.number().int().nonnegative(),
    codeDuplicate: z.number().int().nonnegative(),
    knip: z.number().int().nonnegative(),
    outdated: z.number().int().nonnegative(),
    llmReported: z.number().int().nonnegative().nullable(),
  })
  .strict();

/**
 * Contrato DSFT-96. `prsOpened` pode vir vazio do modelo; o orchestrator preenche URLs após criar PRs.
 */
export const gardenerOutputSchema = z
  .object({
    runType: gardenerRunTypeSchema,
    issuesFound: z.number().int().nonnegative(),
    prsOpened: z.array(gardenerPrOpenedSchema),
    reportPath: z.string().min(1),
    breakdown: gardenerBreakdownSchema.nullable(),
  })
  .strict();

export type GardenerOutput = z.infer<typeof gardenerOutputSchema>;
export type GardenerPrOpened = z.infer<typeof gardenerPrOpenedSchema>;
export type GardenerBreakdown = z.infer<typeof gardenerBreakdownSchema>;
