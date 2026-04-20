import { join } from 'node:path';

export const RUNS_DIR = 'runs';
export const CONTRACTS_DIR = 'contracts';

export function contractFileName(sprint: number): string {
  return `sprint-${sprint}.md`;
}

export type ContractPathOptions = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly sprint: number;
  readonly maestroDir?: string;
};

export function resolveContractPath(options: ContractPathOptions): string {
  const dir = options.maestroDir ?? '.maestro';
  return join(
    options.repoRoot,
    dir,
    RUNS_DIR,
    options.runId,
    CONTRACTS_DIR,
    contractFileName(options.sprint),
  );
}
