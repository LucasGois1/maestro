import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

import {
  DEFAULT_CONFIG,
  resolveConfigPaths,
  writeConfigFile,
  type MaestroConfigInput,
} from '@maestro/config';
import {
  appendProjectLog,
  maestroRoot,
  type ProjectLogEntry,
} from '@maestro/state';

export type AgentKBContext = {
  readonly agentsMd: string;
  readonly architectureMd: string;
  readonly agentsPath: string;
  readonly architecturePath: string;
};

export interface KBManager {
  init(): Promise<void>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(pattern: string): Promise<string[]>;
  getAgentContext(): Promise<AgentKBContext>;
  appendLog(entry: ProjectLogEntry): Promise<void>;
}

export type CreateKBManagerOptions = {
  readonly repoRoot: string;
  readonly maestroDir?: string;
};

const DOC_INDEXES = [
  'docs/design-docs/index.md',
  'docs/exec-plans/active/.gitkeep',
  'docs/exec-plans/completed/.gitkeep',
  'docs/exec-plans/tech-debt-tracker.md',
  'docs/product-specs/index.md',
  'docs/golden-principles/index.md',
  'docs/references/index.md',
  'docs/generated/index.md',
  'runs/.gitkeep',
  'agents/.gitkeep',
];

const DEFAULT_AGENTS_MD = `# AGENTS

## Header
Project: Maestro-managed repository
Stack: Document your runtime, framework, and primary languages here.
Version: Maestro v0.1

## Repo Map
- Fill in the top-level directories that matter most.

## Docs
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Product Specs](./docs/product-specs/index.md)
- [Exec Plans](./docs/exec-plans/tech-debt-tracker.md)
- [Golden Principles](./docs/golden-principles/index.md)

## Essential Commands
- install:
- test:
- build:
- run:

## Critical Conventions
- Keep this section to five bullets or fewer.

## Escalation Path
- Describe when the agent should stop and ask a human.
`;

const DEFAULT_ARCHITECTURE_MD = `# ARCHITECTURE

## Bird's Eye View
Summarize the system in one short paragraph.

## Code Map
Describe which folders/modules own which responsibilities.

## Cross-Cutting Concerns
Call out auth, logging, errors, observability, and other shared concerns.

## Module Boundaries
Document which directions of dependency are allowed.

## Data Flow
Explain the main runtime or request flow through the system.
`;

const DEFAULT_SENSORS_JSON = `${JSON.stringify(
  {
    concurrency: 4,
    sensors: [],
  },
  null,
  2,
)}\n`;

const DEFAULT_PERMISSIONS_JSON = `${JSON.stringify(
  { allowlist: [], denylist: [] },
  null,
  2,
)}\n`;

function buildPlaceholder(relativePath: string): string {
  if (relativePath.endsWith('.gitkeep')) {
    return '';
  }

  const title = relativePath
    .split('/')
    .pop()
    ?.replace(/\.md$/u, '')
    .replace(/-/gu, ' ')
    .replace(/\b\w/gu, (char) => char.toUpperCase());

  return `# ${title ?? 'Document'}\n\nAdd project-specific content here.\n`;
}

async function writeIfMissing(path: string, content: string): Promise<void> {
  try {
    await readFile(path, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf8');
      return;
    }
    throw error;
  }
}

async function writeConfigIfMissing(
  path: string,
  data: MaestroConfigInput,
): Promise<void> {
  try {
    await readFile(path, 'utf8');
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      await writeConfigFile(path, data);
      return;
    }
    throw error;
  }
}

function escapeRegex(input: string): string {
  return input.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
}

function globToRegExp(glob: string): RegExp {
  let source = '';

  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    const next = glob[i + 1];

    if (char === undefined) {
      continue;
    }
    if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
      continue;
    }
    if (char === '*') {
      source += '[^/]*';
      continue;
    }
    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegex(char);
  }

  return new RegExp(`^${source}$`, 'u');
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(fullPath);
      }
      return [fullPath];
    }),
  );

  return files.flat();
}

export function createKBManager(options: CreateKBManagerOptions): KBManager {
  const root = maestroRoot(options.repoRoot, options.maestroDir);
  const pathFor = (path: string) => join(root, path);

  return {
    async init() {
      await mkdir(root, { recursive: true });
      const projectConfigPath = resolveConfigPaths({
        cwd: options.repoRoot,
      }).project;
      await writeConfigIfMissing(projectConfigPath, DEFAULT_CONFIG);
      await writeIfMissing(pathFor('AGENTS.md'), DEFAULT_AGENTS_MD);
      await writeIfMissing(pathFor('ARCHITECTURE.md'), DEFAULT_ARCHITECTURE_MD);
      await writeIfMissing(pathFor('sensors.json'), DEFAULT_SENSORS_JSON);
      await writeIfMissing(
        pathFor('permissions.json'),
        DEFAULT_PERMISSIONS_JSON,
      );

      for (const relativePath of DOC_INDEXES) {
        await writeIfMissing(
          pathFor(relativePath),
          buildPlaceholder(relativePath),
        );
      }
    },

    async read(path: string) {
      return await readFile(pathFor(path), 'utf8');
    },

    async write(path: string, content: string) {
      const filePath = pathFor(path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, 'utf8');
    },

    async list(pattern: string) {
      const files = await walk(root);
      const matcher = globToRegExp(pattern);

      return files
        .map((file) => relative(root, file).replace(/\\/gu, '/'))
        .filter((file) => matcher.test(file))
        .sort((left, right) => left.localeCompare(right));
    },

    async getAgentContext() {
      const agentsPath = pathFor('AGENTS.md');
      const architecturePath = pathFor('ARCHITECTURE.md');

      const [agentsMd, architectureMd] = await Promise.all([
        readFile(agentsPath, 'utf8'),
        readFile(architecturePath, 'utf8'),
      ]);

      return {
        agentsMd,
        architectureMd,
        agentsPath,
        architecturePath,
      };
    },

    async appendLog(entry: ProjectLogEntry) {
      await appendProjectLog({
        repoRoot: options.repoRoot,
        ...(options.maestroDir !== undefined
          ? { maestroDir: options.maestroDir }
          : {}),
        entry,
      });
    },
  };
}
