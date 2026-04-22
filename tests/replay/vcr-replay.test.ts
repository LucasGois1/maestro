import { join } from 'node:path';

import { createVcr } from '@maestro/testkit';
import { describe, expect, it } from 'vitest';

describe('DSFT-97 replay cassettes', () => {
  it('replays committed provider cassettes without network or recorder calls', async () => {
    const vcr = createVcr({
      cassetteDir: join(process.cwd(), 'tests', 'fixtures', 'cassettes'),
      mode: 'replay',
    });

    const text = await vcr.runText(
      'provider-openai-smoke',
      { provider: 'openai', modelId: 'gpt-5-nano', prompt: 'Say ok.' },
      async () => {
        throw new Error('recording is forbidden in replay tests');
      },
    );

    expect(text).toBe('ok');
  });
});
