import { describe, expect, it } from 'vitest';

import {
  FIXTURE_COMPLETED_GH,
  FIXTURE_DRAFT,
  FIXTURE_GITLAB,
  FIXTURE_NO_REMOTE,
  FIXTURE_PARTIAL,
} from './fixtures-data.js';
import { mergerModelOutputSchema } from './merger-output.schema.js';

describe('mergerModelOutputSchema', () => {
  it.each([
    ['FIXTURE_COMPLETED_GH', FIXTURE_COMPLETED_GH.output],
    ['FIXTURE_NO_REMOTE', FIXTURE_NO_REMOTE.output],
    ['FIXTURE_DRAFT', FIXTURE_DRAFT.output],
    ['FIXTURE_GITLAB', FIXTURE_GITLAB.output],
    ['FIXTURE_PARTIAL', FIXTURE_PARTIAL.output],
  ] as const)('parses %s', (_name, output) => {
    expect(() => mergerModelOutputSchema.parse(output)).not.toThrow();
  });
});
