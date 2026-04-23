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
    description:
      'Resume a run; without runId, uses the last-started run (by started time)',
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

/**
 * `/run list` was matching `run` with prompt "list". Rewrite common `run …`
 * typos so they resolve to `runs …` subcommands instead.
 */
function rewriteRunVsRunsCollision(trimmed: string): string {
  if (/^run\s+list\s*$/iu.test(trimmed)) {
    return 'runs list';
  }
  if (/^run\s+ls\s*$/iu.test(trimmed)) {
    return 'runs list';
  }
  if (/^run\s+show\b/iu.test(trimmed)) {
    return trimmed.replace(/^run\s+/iu, 'runs ');
  }
  if (/^run\s+clean\b/iu.test(trimmed)) {
    return trimmed.replace(/^run\s+/iu, 'runs ');
  }
  return trimmed;
}

/** Normalized line after optional `maestro` prefix and `run`/`runs` disambiguation. */
export function prepareTuiCommandInput(input: string): string {
  const base = normalizeCommandInput(input).trim();
  return rewriteRunVsRunsCollision(base);
}

export function suggestCommands(
  input: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): readonly CommandSuggestion[] {
  const normalized = prepareTuiCommandInput(input).trimStart().toLowerCase();
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

/** Commands whose first token equals `root` (case-insensitive). */
export function entriesForSlashRoot(
  root: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): readonly CommandCatalogEntry[] {
  const r = root.trim().toLowerCase();
  if (r.length === 0) {
    return [];
  }
  return catalog.filter((e) => {
    const first = (e.command.split(/\s+/u)[0] ?? '').toLowerCase();
    return first === r;
  });
}

/**
 * True when `usage` contains a required `<placeholder>` (not `[optional]`).
 */
export function commandEntryNeedsTrailingArgs(
  entry: CommandCatalogEntry,
): boolean {
  return /<[a-zA-Z_/][^>]*>/u.test(entry.usage);
}

/**
 * After the user types a single root token (`/runs`, `/config`), show a pick
 * list when the catalog has multiple commands under that root.
 */
export function subcommandPickMenuForPrepared(
  preparedTrimmed: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): { readonly root: string; readonly entries: readonly CommandCatalogEntry[] } | null {
  const prep = preparedTrimmed.trim();
  if (prep.length === 0) {
    return null;
  }
  const tokens = prep.split(/\s+/u).filter(Boolean);
  if (tokens.length !== 1) {
    return null;
  }
  const root = tokens[0];
  if (root === undefined) {
    return null;
  }
  const entries = entriesForSlashRoot(root, catalog);
  return entries.length >= 2 ? { root, entries } : null;
}

export function findCommandEntry(
  input: string,
  catalog: readonly CommandCatalogEntry[] = COMMAND_CATALOG,
): CommandCatalogEntry | null {
  const prepared = prepareTuiCommandInput(input);
  if (prepared.length === 0) {
    return null;
  }
  const padded = `${prepared} `;
  let best: { entry: CommandCatalogEntry; len: number } | null = null;

  for (const entry of catalog) {
    const candidates = [entry.command, ...(entry.aliases ?? [])];
    for (const candidate of candidates) {
      const prefix = `${candidate} `;
      if (prepared === candidate || padded.startsWith(prefix)) {
        const len = candidate.length;
        if (best === null || len > best.len) {
          best = { entry, len };
        }
      }
    }
  }

  return best?.entry ?? null;
}
