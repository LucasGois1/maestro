import { z } from 'zod';

export const sensorSetupCandidateSchema = z
  .object({
    id: z.string().min(1).max(64),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    cwd: z.string().min(1).optional(),
    onFail: z.enum(['block', 'warn']).default('block'),
    rationale: z.string().max(500).default(''),
  })
  .strict();

export const sensorSetupAgentOutputSchema = z
  .object({
    candidates: z.array(sensorSetupCandidateSchema).max(12).default([]),
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
