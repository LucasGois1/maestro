import { describe, expect, it } from 'vitest';

import {
  FIXTURE_API_CHECK,
  FIXTURE_ESCALATED,
  FIXTURE_FAILED_MESSAGE,
  FIXTURE_PASSED,
  FIXTURE_SENSOR_FAILED,
} from './fixtures-data.js';
import { evaluatorModelOutputSchema } from './evaluator-output.schema.js';

describe('evaluatorModelOutputSchema', () => {
  it('parses all calibration fixtures', () => {
    for (const ex of [
      FIXTURE_PASSED,
      FIXTURE_FAILED_MESSAGE,
      FIXTURE_ESCALATED,
      FIXTURE_SENSOR_FAILED,
      FIXTURE_API_CHECK,
    ]) {
      const r = evaluatorModelOutputSchema.safeParse(ex.output);
      expect(r.success, JSON.stringify(r)).toBe(true);
    }
  });
});
