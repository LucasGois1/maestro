import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';

const DEFAULT_USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

export type MockTextModelOptions = {
  readonly text: string;
  readonly provider?: string;
  readonly modelId?: string;
  readonly usage?: LanguageModelV3Usage;
};

export function mockStreamParts(
  text: string,
  usage: LanguageModelV3Usage = DEFAULT_USAGE,
): LanguageModelV3StreamPart[] {
  return [
    { type: 'text-start', id: '0' },
    { type: 'text-delta', id: '0', delta: text },
    { type: 'text-end', id: '0' },
    {
      type: 'finish',
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
    },
  ];
}

export function mockGenerateResult(
  text: string,
  usage: LanguageModelV3Usage = DEFAULT_USAGE,
): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage,
    warnings: [],
  };
}

export function createMockTextModel({
  text,
  provider = 'mock',
  modelId = 'mock-llm',
  usage = DEFAULT_USAGE,
}: MockTextModelOptions): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    provider,
    modelId,
    doGenerate: async () => mockGenerateResult(text, usage),
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: mockStreamParts(text, usage) }),
    }),
  });
}
