import type { ComputationalDiscoveryResult } from './types.js';
import { detectStack } from './stack-detector.js';
import { analyzeStructure } from './structural-analyzer.js';

export async function runComputationalDiscovery(
  repoRoot: string,
): Promise<ComputationalDiscoveryResult> {
  const [stack, structure] = await Promise.all([
    detectStack(repoRoot),
    analyzeStructure(repoRoot),
  ]);

  return {
    repoRoot,
    stack,
    structure,
  };
}
