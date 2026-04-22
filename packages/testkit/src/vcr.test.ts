import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createVcr, readCassette, writeCassette } from './vcr.js';

describe('VCR helpers', () => {
  it('replays committed cassettes without invoking the recorder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'maestro-vcr-'));
    await writeCassette(dir, {
      version: 1,
      id: 'provider-openai-smoke',
      provider: 'openai',
      modelId: 'gpt-5-nano',
      request: { prompt: 'Say ok.' },
      response: { text: 'ok' },
      recordedAt: '2026-04-21T00:00:00.000Z',
    });

    const vcr = createVcr({ cassetteDir: dir, mode: 'replay' });
    const text = await vcr.runText(
      'provider-openai-smoke',
      { prompt: 'ignored during replay' },
      async () => {
        throw new Error('recorder should not run');
      },
    );

    expect(text).toBe('ok');
  });

  it('records a new cassette and rejects obvious API keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'maestro-vcr-record-'));
    const vcr = createVcr({ cassetteDir: dir, mode: 'record' });

    await expect(
      vcr.runText(
        'leaky',
        { prompt: 'sk-test-secret should not be committed' },
        async () => 'ok',
      ),
    ).rejects.toThrow(/secret/i);

    const text = await vcr.runText(
      'clean',
      { prompt: 'Say ok.', provider: 'openai', modelId: 'gpt-5-nano' },
      async () => 'ok',
    );
    expect(text).toBe('ok');
    await expect(readFile(join(dir, 'clean.json'), 'utf8')).resolves.toContain(
      '"text": "ok"',
    );
  });

  it('validates cassette shape on read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'maestro-vcr-invalid-'));
    await writeFile(join(dir, 'bad.json'), '{"version":2}', 'utf8');

    await expect(readCassette(dir, 'bad')).rejects.toThrow(/Invalid cassette/);
  });
});
