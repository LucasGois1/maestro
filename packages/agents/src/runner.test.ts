import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';
import { createEventBus, type AgentEvent } from '@maestro/core';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import type { AgentContext, AgentDefinition } from './definition.js';
import {
  AgentOutputParseError,
  AgentValidationError,
  runAgent,
} from './runner.js';

const usage: LanguageModelV3Usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function makeGenerateResult(text: string): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage,
    warnings: [],
  };
}

function makeStream(text: string): LanguageModelV3StreamPart[] {
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

/** `generateText` + `Output.object` uses `doGenerate` (not `doStream`). */
function mockModel(jsonText: string) {
  return new MockLanguageModelV3({
    provider: 'mock',
    modelId: 'mock-1',
    doGenerate: async () => makeGenerateResult(jsonText),
    doStream: async () => ({
      stream: simulateReadableStream({ chunks: makeStream(jsonText) }),
    }),
  });
}

const ctx: AgentContext = {
  agentId: 'tester',
  runId: 'r1',
  workingDir: '/tmp',
  metadata: {},
};

const echoAgent: AgentDefinition<{ value: string }, { echoed: string }> = {
  id: 'tester',
  role: 'pipeline',
  stage: 1,
  systemPrompt: 'Test',
  inputSchema: z.object({ value: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
};

describe('runAgent', () => {
  it('validates input and rejects bad payloads before calling the model', async () => {
    const bus = createEventBus();
    await expect(
      runAgent({
        definition: echoAgent,
        input: { value: 42 } as unknown as { value: string },
        context: ctx,
        bus,
        model: mockModel('{"echoed":"x"}'),
      }),
    ).rejects.toBeInstanceOf(AgentValidationError);
  });

  it('emits a single final delta, validates output, and emits started + completed', async () => {
    const bus = createEventBus();
    const events: AgentEvent[] = [];
    bus.on((e) => {
      if (e.type.startsWith('agent.')) events.push(e as AgentEvent);
    });

    const result = await runAgent({
      definition: echoAgent,
      input: { value: 'hi' },
      context: ctx,
      bus,
      model: mockModel('{"echoed":"hi"}'),
    });

    expect(result.output).toEqual({ echoed: 'hi' });
    expect(result.text).toBe(JSON.stringify({ echoed: 'hi' }, null, 2));
    const types = events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'agent.started',
        'agent.delta',
        'agent.completed',
      ]),
    );
    const deltas = events.filter((e) => e.type === 'agent.delta');
    expect(deltas).toHaveLength(1);
    expect(
      deltas[0]?.type === 'agent.delta' && deltas[0].chunk,
    ).toContain('"echoed"');
  });

  it('rejects markdown-fenced JSON as structured output (no legacy fence stripping)', async () => {
    const bus = createEventBus();
    await expect(
      runAgent({
        definition: echoAgent,
        input: { value: 'hi' },
        context: ctx,
        bus,
        model: mockModel('```json\n{"echoed":"fenced"}\n```'),
      }),
    ).rejects.toBeInstanceOf(AgentOutputParseError);
  });

  it('rejects invalid JSON text from the model (no jsonrepair path)', async () => {
    const bus = createEventBus();
    await expect(
      runAgent({
        definition: echoAgent,
        input: { value: 'hi' },
        context: ctx,
        bus,
        model: mockModel('{"echoed":"ok",}'),
      }),
    ).rejects.toBeInstanceOf(AgentOutputParseError);
  });

  it('emits agent.failed when output fails validation', async () => {
    const bus = createEventBus();
    const listener = vi.fn();
    bus.on(listener);

    await expect(
      runAgent({
        definition: echoAgent,
        input: { value: 'hi' },
        context: ctx,
        bus,
        model: mockModel('{"wrong":1}'),
      }),
    ).rejects.toBeInstanceOf(AgentValidationError);

    const failed = listener.mock.calls
      .map((c) => c[0] as AgentEvent)
      .find((e) => e.type === 'agent.failed');
    expect(failed).toBeDefined();
  });

  it('invokes onStart, onComplete, and onError hooks', async () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onError = vi.fn();
    const bus = createEventBus();

    const withHooks: AgentDefinition<{ value: string }, { echoed: string }> = {
      ...echoAgent,
      onStart,
      onComplete,
      onError,
    };

    await runAgent({
      definition: withHooks,
      input: { value: 'hi' },
      context: ctx,
      bus,
      model: mockModel('{"echoed":"hi"}'),
    });
    expect(onStart).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();

    await expect(
      runAgent({
        definition: withHooks,
        input: { value: 'hi' },
        context: ctx,
        bus,
        model: mockModel('not json'),
      }),
    ).rejects.toThrow();
    expect(onError).toHaveBeenCalledOnce();
  });
});
