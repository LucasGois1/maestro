import { z } from 'zod';

/** Input do sensor inferencial code-reviewer (DSFT-95). */
export const codeReviewInputSchema = z
  .object({
    diff: z.string(),
    sprintContract: z.string().default(''),
    goldenPrinciples: z.array(z.string()).default([]),
    agentsMd: z.string().default(''),
  })
  .strict();

export type CodeReviewInput = z.infer<typeof codeReviewInputSchema>;
