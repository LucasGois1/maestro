import { describe, expect, it } from 'vitest';

import {
  FIXTURE_CLEAN,
  FIXTURE_LONG_FUNCTION,
  FIXTURE_NAMING,
  FIXTURE_SQL_INJECTION,
  FIXTURE_SUBTLE_BUG,
  FIXTURE_SWALLOWED_ERRORS,
  FIXTURE_WEAK_TESTS,
} from './fixtures-data.js';
import { codeReviewOutputSchema } from '@maestro/sensors';

describe('codeReviewOutputSchema', () => {
  it.each([
    ['FIXTURE_SQL_INJECTION', FIXTURE_SQL_INJECTION.output],
    ['FIXTURE_LONG_FUNCTION', FIXTURE_LONG_FUNCTION.output],
    ['FIXTURE_NAMING', FIXTURE_NAMING.output],
    ['FIXTURE_WEAK_TESTS', FIXTURE_WEAK_TESTS.output],
    ['FIXTURE_CLEAN', FIXTURE_CLEAN.output],
    ['FIXTURE_SUBTLE_BUG', FIXTURE_SUBTLE_BUG.output],
    ['FIXTURE_SWALLOWED_ERRORS', FIXTURE_SWALLOWED_ERRORS.output],
  ] as const)('parses %s', (_name, output) => {
    expect(() => codeReviewOutputSchema.parse(output)).not.toThrow();
  });
});
