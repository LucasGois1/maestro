import { describe, expect, it } from 'vitest';

import { sensorSetupAgentOutputSchema } from './sensor-setup-schemas.js';

describe('sensorSetupAgentOutputSchema', () => {
  it('parses empty candidates', () => {
    const out = sensorSetupAgentOutputSchema.parse({ candidates: [] });
    expect(out.candidates).toEqual([]);
  });

  it('parses candidate rows', () => {
    const out = sensorSetupAgentOutputSchema.parse({
      candidates: [
        {
          id: 'lint',
          command: 'pnpm',
          args: ['run', 'lint'],
          onFail: 'block',
          rationale: 'Uses package.json lint script.',
        },
      ],
    });
    expect(out.candidates[0]?.id).toBe('lint');
  });
});
