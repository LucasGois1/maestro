import { z } from 'zod';

/** Conventional Commits header: type(scope): subject ou type: subject */
const CONVENTIONAL_COMMIT_MESSAGE_RE =
  /^(?:revert:\s.+|(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([^)]+\))?:\s+.+)/u;

export const generatorModelOutputSchema = z
  .object({
    /** Same 0-based cursor as INPUT.sprintIdx (pipeline loop index), not plan sprint.idx. */
    sprintIdx: z.number().int().nonnegative(),
    filesChanged: z.array(
      z.object({
        path: z.string().min(1),
        changeType: z.enum(['added', 'modified', 'deleted']),
      }),
    ),
    commits: z.array(
      z.object({
        sha: z.string().min(1),
        message: z.string().min(1),
      }),
    ),
    selfEval: z.object({
      coversAllCriteria: z.boolean(),
      missingCriteria: z.array(z.string()),
      concerns: z.array(z.string()),
    }),
    handoffNotes: z.string(),
  })
  .superRefine((val, ctx) => {
    for (let i = 0; i < val.commits.length; i += 1) {
      const msg = val.commits[i]?.message ?? '';
      if (!CONVENTIONAL_COMMIT_MESSAGE_RE.test(msg.trim())) {
        ctx.addIssue({
          code: 'custom',
          message: `commits[${i.toString()}].message must follow Conventional Commits (e.g. feat(scope): summary)`,
          path: ['commits', i, 'message'],
        });
      }
    }
  });

export type GeneratorModelOutput = z.infer<typeof generatorModelOutputSchema>;
