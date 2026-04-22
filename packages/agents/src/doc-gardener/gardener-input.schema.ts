import { z } from 'zod';

export const gardenerRunTypeSchema = z.enum(['doc', 'code', 'all']);

export const gardenerInputSchema = z
  .object({
    repoRoot: z.string().min(1),
    runType: gardenerRunTypeSchema,
    /** Caminho absoluto ou relativo ao cwd onde o relatório será escrito (definido pelo orchestrator). */
    reportPath: z.string().min(1),
    /** Excertos opcionais para contexto sem reler disco no modelo. */
    agentsMdPreview: z.string().default(''),
    goldenPrinciplesPreview: z.string().default(''),
    /** Resumo de paths relevantes (docs, .maestro). */
    scanRootsHint: z.string().default(''),
  })
  .strict();

export type GardenerInput = z.infer<typeof gardenerInputSchema>;
