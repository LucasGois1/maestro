import { z } from 'zod';

/**
 * Strict JSON-schema shape for provider structured output: every property must be
 * listed in `required` (OpenAI / response_format). No Zod `.default()` on object
 * fields — defaults are applied after parse in callers when needed.
 */
export const sensorSetupCandidateSchema = z
  .object({
    id: z.string().min(1).max(64),
    command: z.string().min(1),
    args: z.array(z.string()),
    cwd: z.union([z.string().min(1), z.null()]),
    onFail: z.enum(['block', 'warn']),
    rationale: z.string().max(500),
  })
  .strict();

export const sensorSetupAgentOutputSchema = z
  .object({
    candidates: z.array(sensorSetupCandidateSchema).max(12),
  })
  .strict();

export const sensorSetupAgentInputSchema = z.object({
  repoRoot: z.string().min(1),
  stackKind: z.string(),
  stackMarkers: z.array(z.string()),
  stackHintsJson: z.string(),
  topLevelNames: z.array(z.string()),
  packageJsonScriptsJson: z.string().nullable(),
  heuristicSummary: z.string(),
});

export type SensorSetupAgentInput = z.infer<typeof sensorSetupAgentInputSchema>;
export type SensorSetupAgentOutput = z.infer<typeof sensorSetupAgentOutputSchema>;
export type SensorSetupCandidate = z.infer<typeof sensorSetupCandidateSchema>;
