import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { generateText, streamText, wrapLanguageModel } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';

import {
  createObservabilityMiddleware,
  type ProviderEvent,
} from './observability.js';

const fakeUsage: LanguageModelV3Usage = {
  inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 2, text: 2, reasoning: 0 },
};

const generateResult: LanguageModelV3GenerateResult = {
  content: [{ type: 'text', text: 'hello' }],
  finishReason: { unified: 'stop' as const, raw: 'stop' },
  usage: fakeUsage,
  warnings: [],
};

const streamParts: LanguageModelV3StreamPart[] = [
  { type: 'text-start', id: '0' },
  { type: 'text-delta', id: '0', delta: 'hello' },
  { type: 'text-end', id: '0' },
  {
    type: 'finish',
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: fakeUsage,
  },
];

function makeMock(behavior: 'ok' | 'throw' = 'ok') {
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: 'mock-1',
    doGenerate: async () => {
      if (behavior === 'throw') throw new Error('boom');
      return generateResult;
    },
    doStream: async () => {
      if (behavior === 'throw') throw new Error('boom');
      return {
        stream: simulateReadableStream({ chunks: streamParts }),
      };
    },
  });
}

describe('observability middleware', () => {
  it('emits start + finish with usage on generateText', async () => {
    const events: ProviderEvent[] = [];
    const wrapped = wrapLanguageModel({
      model: makeMock(),
      middleware: createObservabilityMiddleware((e) => events.push(e)),
    });

    const result = await generateText({ model: wrapped, prompt: 'hi' });
    expect(result.text).toBe('hello');

    const types = events.map((e) => e.type);
    expect(types).toContain('start');
    expect(types).toContain('finish');

    const finish = events.find((e) => e.type === 'finish');
    expect(finish?.operation).toBe('generate');
    expect(finish?.type === 'finish' && finish.usage?.outputTokens.total).toBe(
      2,
    );
  });

  it('emits start + finish on streamText', async () => {
    const events: ProviderEvent[] = [];
    const wrapped = wrapLanguageModel({
      model: makeMock(),
      middleware: createObservabilityMiddleware((e) => events.push(e)),
    });

    const result = streamText({ model: wrapped, prompt: 'hi' });
    let text = '';
    for await (const delta of result.textStream) text += delta;
    expect(text).toBe('hello');

    const types = events.map((e) => e.type);
    expect(types).toContain('start');
    expect(types).toContain('finish');

    const finish = events.find((e) => e.type === 'finish');
    expect(finish?.operation).toBe('stream');
  });

  it('emits error on doGenerate failure', async () => {
    const listener = vi.fn();
    const wrapped = wrapLanguageModel({
      model: makeMock('throw'),
      middleware: createObservabilityMiddleware(listener),
    });

    await expect(
      generateText({ model: wrapped, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toThrow();

    const errored = listener.mock.calls
      .map((c) => c[0] as ProviderEvent)
      .some((e) => e.type === 'error' && e.operation === 'generate');
    expect(errored).toBe(true);
  });
});
