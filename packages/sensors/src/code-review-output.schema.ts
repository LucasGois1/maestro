import { z } from 'zod';

export const codeReviewViolationSeveritySchema = z.enum([
  'info',
  'warning',
  'error',
]);

export const codeReviewViolationCategorySchema = z.enum([
  'smell',
  'security',
  'style',
  'testing',
  'convention',
]);

export const codeReviewViolationSchema = z
  .object({
    severity: codeReviewViolationSeveritySchema,
    category: codeReviewViolationCategorySchema,
    file: z.string().min(1),
    line: z.number().int().nonnegative().nullable(),
    message: z.string().min(1),
    suggestion: z.string().nullable(),
  })
  .strict();

export const codeReviewOutputSchema = z
  .object({
    violations: z.array(codeReviewViolationSchema),
    summary: z.string(),
    /** True quando não há violações com severity "error" (warnings não bloqueiam). */
    pass: z.boolean(),
  })
  .strict();

export type CodeReviewOutput = z.infer<typeof codeReviewOutputSchema>;
export type CodeReviewViolation = z.infer<typeof codeReviewViolationSchema>;
