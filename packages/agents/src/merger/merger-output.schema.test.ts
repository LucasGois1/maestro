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
  it('rejects non-URL prUrl when paired with prNumber', () => {
    const bad = {
      ...FIXTURE_COMPLETED_GH.output,
      prUrl: 'not-a-url',
    };
    expect(() => mergerModelOutputSchema.parse(bad)).toThrow(
      /parseable absolute URL/u,
    );
  });

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
