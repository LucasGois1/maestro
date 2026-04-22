import { streamText } from 'ai';
import { describe, expect, it } from 'vitest';

import { createMockTextModel, mockStreamParts } from './mock-llm.js';

describe('mock LLM helpers', () => {
  it('streams deterministic text from a MockLanguageModelV3', async () => {
    const model = createMockTextModel({ text: '{"ok":true}' });
    const result = streamText({ model, prompt: 'say json' });

    let text = '';
    for await (const delta of result.textStream) text += delta;

    expect(text).toBe('{"ok":true}');
    expect(model.provider).toBe('mock');
    expect(model.modelId).toBe('mock-llm');
  });

  it('builds stream parts with a finish event and usage', () => {
    const parts = mockStreamParts('hello');
    expect(parts.map((p) => p.type)).toEqual([
      'text-start',
      'text-delta',
      'text-end',
      'finish',
    ]);
  });
});
