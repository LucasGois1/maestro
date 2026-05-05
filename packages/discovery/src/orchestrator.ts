import type { MaestroConfig } from '@maestro/config';
import { discoveryAgent, runAgent } from '@maestro/agents';
import { createEventBus, type MaestroEvent } from '@maestro/core';

import { runComputationalDiscovery } from './computational.js';
import {
  sampleRepositoryFiles,
  type SampleRepositoryFilesOptions,
} from './sampling.js';

export type InferentialDiscoveryProgressStep =
  | 'computational'
  | 'sampling'
  | 'llm';

export type RunInferentialDiscoveryOptions = {
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  readonly runId?: string;
  readonly sampling?: SampleRepositoryFilesOptions;
  /** Fired before each major step (computational may repeat work if callers also run it). */
  readonly onProgress?: (
    step: InferentialDiscoveryProgressStep,
    detail?: string,
  ) => void;
  /** All bus events (including `agent.delta` chunks) for UI or file logging. */
  readonly onMaestroEvent?: (event: MaestroEvent) => void;
};

/**
 * Retry function with exponential backoff for 429 errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    readonly maxRetries?: number;
    readonly initialDelayMs?: number;
    readonly maxDelayMs?: number;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 5;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 30000;

  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if it's a 429 error
      const isRateLimit = 
        lastError.message.includes('429') ||
        lastError.message.includes('rate limit') ||
        lastError.message.includes('too many requests');
      
      if (!isRateLimit || attempt === maxRetries) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt),
        maxDelayMs,
      );
      
      // Add jitter to avoid thundering herd
      const jitter = Math.random() * 0.2 * delay;
      const totalDelay = delay + jitter;
      
      // Silent retry - no console output to avoid TUI interference
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  throw lastError;
}

export async function runInferentialDiscovery(
  options: RunInferentialDiscoveryOptions,
): Promise<{ readonly agentsMd: string; readonly architectureMd: string }> {
  options.onProgress?.('computational');
  const computational = await runComputationalDiscovery(options.repoRoot);
  const samples = await sampleRepositoryFiles(
    options.repoRoot,
    computational,
    options.sampling,
  );
  options.onProgress?.('sampling', `${String(samples.length)} file sample(s)`);
  const bus = createEventBus();
  if (options.onMaestroEvent) {
    bus.on(options.onMaestroEvent);
  }
  const runId = options.runId ?? 'discovery';
  options.onProgress?.('llm');

  const hintRecord: Record<string, unknown> = {
    ...computational.stack.hints,
  };

  const result = await retryWithBackoff(
    async () => {
      return await runAgent({
        definition: discoveryAgent,
        input: {
          repoRoot: options.repoRoot,
          stack: {
            kind: computational.stack.kind,
            markers: [...computational.stack.markers],
            hints: hintRecord,
          },
          structure: {
            topLevelNames: [...computational.structure.topLevelNames],
            extensionCounts: { ...computational.structure.extensionCounts },
            testDirectoryHints: [...computational.structure.testDirectoryHints],
            approxFileCount: computational.structure.approxFileCount,
          },
          fileSamples: samples,
        },
        context: {
          agentId: 'discovery',
          runId,
          workingDir: options.repoRoot,
          metadata: {},
        },
        bus,
        config: options.config,
      });
    },
    { maxRetries: 5, initialDelayMs: 2000, maxDelayMs: 30000 },
  ).catch((error) => {
    // Enhance error with more details
    if (error instanceof Error) {
      let details = error.message;
      if ('cause' in error && error.cause instanceof Error) {
        details += ` | Cause: ${error.cause.message}`;
      }
      if ('response' in error) {
        const response = (error as any).response;
        if (response) {
          details += ` | Response: ${JSON.stringify(response)}`;
        }
      }
      if ('statusCode' in error) {
        details += ` | Status: ${(error as any).statusCode}`;
      }
      if ('data' in error) {
        details += ` | Data: ${JSON.stringify((error as any).data)}`;
      }
      throw new Error(`Discovery agent error: ${details}`);
    }
    throw error;
  });

  return result.output as {
    readonly agentsMd: string;
    readonly architectureMd: string;
  };
}
