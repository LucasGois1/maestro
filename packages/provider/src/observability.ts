import type {
  LanguageModelV3,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from '@ai-sdk/provider';

export type ProviderOperation = 'generate' | 'stream';

export type ProviderEvent =
  | {
      readonly type: 'start';
      readonly provider: string;
      readonly modelId: string;
      readonly operation: ProviderOperation;
      readonly timestamp: number;
    }
  | {
      readonly type: 'finish';
      readonly provider: string;
      readonly modelId: string;
      readonly operation: ProviderOperation;
      readonly durationMs: number;
      readonly usage?: LanguageModelV3Usage;
    }
  | {
      readonly type: 'error';
      readonly provider: string;
      readonly modelId: string;
      readonly operation: ProviderOperation;
      readonly durationMs: number;
      readonly error: unknown;
    };

export type ProviderEventListener = (event: ProviderEvent) => void;

type ModelIdentity = {
  readonly provider: string;
  readonly modelId: string;
};

function identity(model: LanguageModelV3): ModelIdentity {
  return { provider: model.provider, modelId: model.modelId };
}

function now(): number {
  return Date.now();
}

export function createObservabilityMiddleware(
  onEvent: ProviderEventListener,
): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3',

    async wrapGenerate({ doGenerate, model }) {
      const ident = identity(model);
      const started = now();
      onEvent({
        type: 'start',
        ...ident,
        operation: 'generate',
        timestamp: started,
      });
      try {
        const result = await doGenerate();
        onEvent({
          type: 'finish',
          ...ident,
          operation: 'generate',
          durationMs: now() - started,
          usage: result.usage,
        });
        return result;
      } catch (error) {
        onEvent({
          type: 'error',
          ...ident,
          operation: 'generate',
          durationMs: now() - started,
          error,
        });
        throw error;
      }
    },

    async wrapStream({ doStream, model }) {
      const ident = identity(model);
      const started = now();
      onEvent({
        type: 'start',
        ...ident,
        operation: 'stream',
        timestamp: started,
      });

      let finalUsage: LanguageModelV3Usage | undefined;
      let finalized = false;
      const finalize = (outcome: 'finish' | 'error', error?: unknown) => {
        if (finalized) return;
        finalized = true;
        if (outcome === 'finish') {
          onEvent({
            type: 'finish',
            ...ident,
            operation: 'stream',
            durationMs: now() - started,
            ...(finalUsage !== undefined ? { usage: finalUsage } : {}),
          });
        } else {
          onEvent({
            type: 'error',
            ...ident,
            operation: 'stream',
            durationMs: now() - started,
            error,
          });
        }
      };

      try {
        const result = await doStream();
        const tap = new TransformStream<
          LanguageModelV3StreamPart,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            if (chunk.type === 'finish') {
              finalUsage = chunk.usage;
            }
            controller.enqueue(chunk);
          },
          flush() {
            finalize('finish');
          },
        });
        return {
          ...result,
          stream: result.stream.pipeThrough(tap),
        };
      } catch (error) {
        finalize('error', error);
        throw error;
      }
    },
  };
}
