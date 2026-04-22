export type CommandHandlerId =
  | 'run'
  | 'resume'
  | 'abort'
  | 'runs'
  | 'config'
  | 'git'
  | 'kb'
  | 'background'
  | 'tui';

export type CommandCatalogEntry = {
  readonly command: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly handlerId: CommandHandlerId;
};

export type CommandSuggestion = {
  readonly entry: CommandCatalogEntry;
  readonly completion: string;
};

export const COMMAND_CATALOG: readonly CommandCatalogEntry[] = [
  {
    command: 'run',
    description: 'Start a Maestro pipeline run from a task prompt',
    usage: 'run <prompt>',
    handlerId: 'run',
  },
  {
    command: 'resume',
    description: 'Resume a paused run, or the latest paused run',
    usage: 'resume [runId]',
    handlerId: 'resume',
  },
  {
    command: 'abort',
    description: 'Cancel a run immediately',
    usage: 'abort [runId]',
    handlerId: 'abort',
  },
  {
    command: 'runs list',
    aliases: ['runs ls'],
    description: 'List runs recorded in .maestro/runs',
    usage: 'runs list',
    handlerId: 'runs',
  },
  {
    command: 'runs show',
    description: 'Show a single run in detail',
    usage: 'runs show <runId>',
    handlerId: 'runs',
  },
  {
    command: 'runs clean',
    description: 'Delete completed runs after confirmation',
    usage: 'runs clean [--force]',
    handlerId: 'runs',
  },
  {
    command: 'config get',
    description: 'Print a config value by dot-path',
    usage: 'config get <path>',
    handlerId: 'config',
  },
  {
    command: 'config set',
    description: 'Set a config value',
    usage: 'config set <path> <value>',
    handlerId: 'config',
  },
  {
    command: 'config list',
    description: 'Print the effective config with secrets masked',
    usage: 'config list',
    handlerId: 'config',
  },
  {
    command: 'config path',
    description: 'Print config file locations',
    usage: 'config path',
    handlerId: 'config',
  },
  {
    command: 'config validate',
    description: 'Validate the effective config',
    usage: 'config validate',
    handlerId: 'config',
  },
  {
    command: 'git status',
    description: 'Show repository and Maestro worktree status',
    usage: 'git status',
    handlerId: 'git',
  },
  {
    command: 'git cleanup',
    description: 'Clean up old Maestro worktrees',
    usage: 'git cleanup [--force]',
    handlerId: 'git',
  },
  {
    command: 'kb lint',
    description: 'Validate Maestro knowledge-base files',
    usage: 'kb lint [--fix]',
    handlerId: 'kb',
  },
  {
    command: 'kb refresh',
    description: 'Refresh knowledge-base docs from discovery',
    usage: 'kb refresh',
    handlerId: 'kb',
  },
  {
    command: 'background run',
    description: 'Run background Doc Gardener checks',
    usage: 'background run [--type all|doc|code]',
    handlerId: 'background',
  },
  {
    command: 'tui',
    description: 'Launch the Maestro TUI shell',
    usage: 'tui [--demo]',
    handlerId: 'tui',
  },
] as const;

export function normalizeCommandInput(input: string): string {
  const trimmed = input.trimStart();
  return trimmed.startsWith('maestro ')
    ? trimmed.slice('maestro '.length).trimStart()
    : trimmed;
}

export function suggestCommands(
  input: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): readonly CommandSuggestion[] {
  const normalized = normalizeCommandInput(input).trimStart().toLowerCase();
  if (normalized.length === 0) {
    return catalog.slice(0, 6).map((entry) => ({
      entry,
      completion: `${entry.command} `,
    }));
  }
  return catalog
    .filter((entry) => {
      const candidates = [entry.command, ...(entry.aliases ?? [])];
      return candidates.some((candidate) =>
        commandMatches(candidate, normalized),
      );
    })
    .slice(0, 6)
    .map((entry) => ({
      entry,
      completion: `${entry.command} `,
    }));
}

function commandMatches(candidate: string, normalizedInput: string): boolean {
  const normalizedCandidate = candidate.toLowerCase();
  if (normalizedCandidate.startsWith(normalizedInput)) {
    return true;
  }
  const inputParts = normalizedInput.split(/\s+/u).filter(Boolean);
  const candidateParts = normalizedCandidate.split(/\s+/u);
  return inputParts.every((part) =>
    candidateParts.some((candidatePart) => candidatePart.startsWith(part)),
  );
}

export function findCommandEntry(
  input: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): CommandCatalogEntry | null {
  const normalized = normalizeCommandInput(input).trim();
  if (normalized.length === 0) {
    return null;
  }
  const padded = `${normalized} `;
  return (
    catalog.find((entry) => {
      const candidates = [entry.command, ...(entry.aliases ?? [])];
      return candidates.some((candidate) => padded.startsWith(`${candidate} `));
    }) ?? null
  );
}
