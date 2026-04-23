import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { generateText, Output, stepCountIs, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { plannerModelOutputSchema } from './planner/plan-output.schema.js';

const usage: LanguageModelV3Usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function textResult(text: string): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage,
    warnings: [],
  };
}

describe('AI SDK structured output (Output.object)', () => {
  it('returns parsed output from doGenerate JSON text', async () => {
    const schema = z.object({ echoed: z.string() });
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-1',
      doGenerate: async () => textResult('{"echoed":"x"}'),
    });

    const result = await generateText({
      model,
      prompt: 'hi',
      output: Output.object({ schema, name: 'echo' }),
    });

    expect(result.output).toEqual({ echoed: 'x' });
  });

  it('supports tool calls then structured output (multi-step)', async () => {
    const schema = z.object({ answer: z.string() });
    const ping = tool({
      description: 'noop',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ q }: { q: string }) => `echo:${q}`,
    });

    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-1',
      doGenerate: [
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'c1',
              toolName: 'ping',
              input: JSON.stringify({ q: 'hi' }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        textResult('{"answer":"done"}'),
      ],
    });

    const result = await generateText({
      model,
      prompt: 'go',
      tools: { ping },
      output: Output.object({ schema, name: 'out' }),
      stopWhen: stepCountIs(6),
    });

    expect(result.output).toEqual({ answer: 'done' });
  });

  it('accepts planner escalation union via the same Zod schema used in production', async () => {
    const payload = {
      escalationReason: 'blocked',
      feature: null,
      overview: null,
      userStories: null,
      aiFeatures: null,
      sprints: null,
    };
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-1',
      doGenerate: async () =>
        textResult(JSON.stringify(payload)),
    });

    const result = await generateText({
      model,
      prompt: 'plan',
      output: Output.object({
        schema: plannerModelOutputSchema,
        name: 'planner',
      }),
    });

    expect(result.output).toEqual(payload);
  });

  it('rejects planner success payloads that fail superRefine (sprint references unknown story id)', async () => {
    const invalidPlan = {
      escalationReason: null,
      feature: 'f',
      overview: 'o',
      userStories: [
        { id: 1, role: 'r', action: 'a', value: 'v' },
      ],
      sprints: [
        {
          idx: 1,
          name: 'S1',
          objective: 'obj',
          userStoryIds: [99],
          dependsOn: [],
          complexity: 'low' as const,
          keyFeatures: [],
        },
      ],
      aiFeatures: [],
    };
    const model = new MockLanguageModelV3({
      provider: 'mock',
      modelId: 'mock-1',
      doGenerate: async () =>
        textResult(JSON.stringify(invalidPlan)),
    });

    await expect(
      generateText({
        model,
        prompt: 'plan',
        output: Output.object({
          schema: plannerModelOutputSchema,
          name: 'planner',
        }),
      }),
    ).rejects.toThrow();
  });
});
