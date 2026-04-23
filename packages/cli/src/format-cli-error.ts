import { BranchNameError } from '@maestro/git';
import { ConfigValidationError } from '@maestro/config';

export function formatCliError(error: unknown): string {
  if (error instanceof ConfigValidationError) {
    return [
      'Configuration is invalid:',
      ...error.issues.map(
        (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      ),
    ].join('\n');
  }
  if (error instanceof BranchNameError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
