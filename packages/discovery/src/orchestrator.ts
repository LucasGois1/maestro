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

  const result = await runAgent({
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

  return result.output as {
    readonly agentsMd: string;
    readonly architectureMd: string;
  };
}
