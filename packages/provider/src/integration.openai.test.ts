import { configSchema } from '@maestro/config';
import { generateText, streamText } from 'ai';
import { describe, expect, it } from 'vitest';

import { getModel } from './get-model.js';
import type { ProviderEvent } from './observability.js';

const apiKey = process.env.MAESTRO_OPENAI_KEY;
const runIntegration = process.env.RUN_INTEGRATION === '1';
const modelId = process.env.MAESTRO_OPENAI_INTEGRATION_MODEL ?? 'gpt-4.1-nano';
const shouldRun = Boolean(apiKey) && runIntegration;
const describeIf = shouldRun ? describe : describe.skip;

describeIf('integration: OpenAI (token-frugal)', () => {
  const config = configSchema.parse({
    providers: { openai: { apiKey } },
  });

  it(`generateText round-trip on ${modelId}`, async () => {
    const model = getModel(`openai/${modelId}`, { config });
    const result = await generateText({
      model,
      prompt: 'Say ok.',
      maxOutputTokens: 32,
    });
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  }, 30_000);

  it(`streamText emits deltas and a finish event on ${modelId}`, async () => {
    const events: ProviderEvent[] = [];
    const model = getModel(`openai/${modelId}`, {
      config,
      onEvent: (e) => events.push(e),
    });
    const result = streamText({
      model,
      prompt: 'Say ok.',
      maxOutputTokens: 32,
    });
    let buf = '';
    for await (const delta of result.textStream) buf += delta;
    expect(buf.length).toBeGreaterThan(0);
    expect(events.some((e) => e.type === 'start')).toBe(true);
    expect(events.some((e) => e.type === 'finish')).toBe(true);
  }, 30_000);
});
