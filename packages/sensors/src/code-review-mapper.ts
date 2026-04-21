import type { Violation } from './types.js';
import {
  codeReviewOutputSchema,
  type CodeReviewOutput,
} from './code-review-output.schema.js';

/**
 * Valida o JSON do modelo e converte para `Violation[]` do registry.
 * `warning` (issue) → `warn` (tipo interno).
 */
export function mapCodeReviewModelToViolations(output: unknown): {
  readonly logicalFailed: boolean;
  readonly violations: readonly Violation[];
  readonly parsed: CodeReviewOutput;
} {
  const parsed = codeReviewOutputSchema.parse(output);
  const hasErrorSeverity = parsed.violations.some((v) => v.severity === 'error');
  const logicalFailed = !parsed.pass || hasErrorSeverity;

  const violations: Violation[] = parsed.violations.map((v) => ({
    rule: 'code-review',
    message: v.message,
    severity:
      v.severity === 'warning' ? 'warn' : v.severity === 'info' ? 'info' : 'error',
    path: v.file,
    ...(v.line !== undefined ? { line: v.line } : {}),
    source: 'code-reviewer',
    category: v.category,
    ...(v.suggestion !== undefined ? { suggestion: v.suggestion } : {}),
  }));

  return { logicalFailed, violations, parsed };
}
