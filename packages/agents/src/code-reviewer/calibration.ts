import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { CODE_REVIEWER_SYSTEM_PROMPT } from './system-prompt.js';
import {
  FIXTURE_CLEAN,
  FIXTURE_LONG_FUNCTION,
  FIXTURE_NAMING,
  FIXTURE_SQL_INJECTION,
  FIXTURE_SUBTLE_BUG,
  FIXTURE_SWALLOWED_ERRORS,
  FIXTURE_WEAK_TESTS,
} from './fixtures-data.js';

export const CODE_REVIEWER_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: FIXTURE_SQL_INJECTION.input,
    output: FIXTURE_SQL_INJECTION.output,
    note: 'SQL injection → error',
  },
  {
    input: FIXTURE_LONG_FUNCTION.input,
    output: FIXTURE_LONG_FUNCTION.output,
    note: 'função longa → warning',
  },
  {
    input: FIXTURE_NAMING.input,
    output: FIXTURE_NAMING.output,
    note: 'naming / convenção',
  },
  {
    input: FIXTURE_WEAK_TESTS.input,
    output: FIXTURE_WEAK_TESTS.output,
    note: 'testes fracos',
  },
  {
    input: FIXTURE_CLEAN.input,
    output: FIXTURE_CLEAN.output,
    note: 'diff limpo',
  },
  {
    input: FIXTURE_SUBTLE_BUG.input,
    output: FIXTURE_SUBTLE_BUG.output,
    note: 'bug sutil (ceticismo)',
  },
  {
    input: FIXTURE_SWALLOWED_ERRORS.input,
    output: FIXTURE_SWALLOWED_ERRORS.output,
    note: 'erros engolidos (ceticismo)',
  },
];

export function resolvedCodeReviewerSystemPrompt(): string {
  return appendCalibrationSection(
    CODE_REVIEWER_SYSTEM_PROMPT,
    CODE_REVIEWER_FEW_SHOT_EXAMPLES,
  );
}
