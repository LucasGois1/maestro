import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { z } from 'zod';

import { buildEnvOverlay } from './env.js';
import { deepMergeAll } from './merge.js';
import { resolveConfigPaths, type ConfigPaths } from './paths.js';
import {
  configSchema,
  type MaestroConfig,
  type MaestroConfigInput,
} from './schema.js';

export class ConfigParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public override readonly cause: unknown,
  ) {
    super(message);
    this.name = 'ConfigParseError';
  }
}

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.core.$ZodIssue[],
    public readonly filePath?: string,
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export type LoadedSource = {
  readonly path: string;
  readonly exists: boolean;
  readonly raw: MaestroConfigInput | null;
};

export type LoadedConfig = {
  readonly paths: ConfigPaths;
  readonly sources: {
    readonly global: LoadedSource;
    readonly project: LoadedSource;
    readonly env: MaestroConfigInput;
    readonly runOverrides: MaestroConfigInput;
  };
  readonly merged: MaestroConfigInput;
  readonly resolved: MaestroConfig;
};

export type LoadConfigOptions = {
  readonly cwd?: string;
  readonly home?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly runOverrides?: MaestroConfigInput;
};

async function readJsonIfExists(filePath: string): Promise<unknown> {
  try {
    const content = await readFile(filePath, 'utf8');
    try {
      return JSON.parse(content);
    } catch (cause) {
      throw new ConfigParseError(
        `Invalid JSON in config file ${filePath}`,
        filePath,
        cause,
      );
    }
  } catch (error) {
    if (isNodeEnoent(error)) {
      return undefined;
    }
    throw error;
  }
}

function isNodeEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}

async function readSource(filePath: string): Promise<LoadedSource> {
  const data = await readJsonIfExists(filePath);
  if (data === undefined) {
    return { path: filePath, exists: false, raw: null };
  }
  return {
    path: filePath,
    exists: true,
    raw: data as MaestroConfigInput,
  };
}

export async function loadConfig(
  options: LoadConfigOptions = {},
): Promise<LoadedConfig> {
  const paths = resolveConfigPaths({
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options.home !== undefined ? { home: options.home } : {}),
  });

  const [globalSource, projectSource] = await Promise.all([
    readSource(paths.global),
    readSource(paths.project),
  ]);

  const envOverlay = buildEnvOverlay(options.env ?? process.env);
  const runOverrides = options.runOverrides ?? {};

  const merged = deepMergeAll<MaestroConfigInput>(
    {},
    globalSource.raw,
    projectSource.raw,
    envOverlay,
    runOverrides,
  );

  const result = configSchema.safeParse(merged);
  if (!result.success) {
    throw new ConfigValidationError(
      'Configuration failed validation',
      result.error.issues,
    );
  }

  const resolved = result.data;

  return {
    paths,
    sources: {
      global: globalSource,
      project: projectSource,
      env: envOverlay,
      runOverrides,
    },
    merged,
    resolved,
  };
}

export async function writeConfigFile(
  filePath: string,
  data: MaestroConfigInput,
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(filePath, serialized, 'utf8');
}

export async function readConfigFile(
  filePath: string,
): Promise<MaestroConfigInput | null> {
  const source = await readSource(filePath);
  return source.raw;
}
