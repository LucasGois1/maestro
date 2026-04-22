import { describe, expect, it } from 'vitest';

import { FIXTURE_CODE_DRIFT, FIXTURE_DOC_LINKS } from './fixtures-data.js';
import { gardenerOutputSchema } from './gardener-output.schema.js';

describe('gardenerOutputSchema', () => {
  it.each([
    ['FIXTURE_DOC_LINKS', FIXTURE_DOC_LINKS.output],
    ['FIXTURE_CODE_DRIFT', FIXTURE_CODE_DRIFT.output],
  ] as const)('parses %s', (_name, output) => {
    expect(() => gardenerOutputSchema.parse(output)).not.toThrow();
  });
});
