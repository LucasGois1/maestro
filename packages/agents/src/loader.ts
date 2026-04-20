import { readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AnyAgentDefinition } from './definition.js';
import type { AgentRegistry } from './registry.js';
import { AgentRegistryError } from './registry.js';

export class AgentLoaderError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AgentLoaderError';
  }
}

const AGENT_FILE_PATTERN = /\.(m?js|ts)$/u;

function isAgentDefinition(value: unknown): value is AnyAgentDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'role' in value &&
    'inputSchema' in value &&
    'outputSchema' in value &&
    'systemPrompt' in value
  );
}

async function listAgentFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(dir, entry);
      const info = await stat(full);
      if (info.isFile() && AGENT_FILE_PATTERN.test(entry)) {
        files.push(full);
      }
    }
    return files.sort();
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }
}

async function importModule(
  filePath: string,
): Promise<Record<string, unknown>> {
  const url = pathToFileURL(resolve(filePath)).href;
  try {
    return (await import(url)) as Record<string, unknown>;
  } catch (cause) {
    throw new AgentLoaderError(
      `Failed to import custom agent at ${filePath}`,
      filePath,
      cause,
    );
  }
}

function extractDefinitions(
  module: Record<string, unknown>,
  filePath: string,
): AnyAgentDefinition[] {
  const found: AnyAgentDefinition[] = [];
  const candidate = module.default ?? module.agent ?? module.definition;
  if (isAgentDefinition(candidate)) found.push(candidate);
  for (const value of Object.values(module)) {
    if (isAgentDefinition(value) && !found.includes(value)) {
      found.push(value);
    }
  }
  if (found.length === 0) {
    throw new AgentLoaderError(
      `No AgentDefinition exports found in ${filePath}`,
      filePath,
    );
  }
  return found;
}

export async function loadCustomAgents(
  dir: string,
  registry: AgentRegistry,
): Promise<AnyAgentDefinition[]> {
  const files = await listAgentFiles(dir);
  const loaded: AnyAgentDefinition[] = [];
  for (const file of files) {
    const module = await importModule(file);
    const defs = extractDefinitions(module, file);
    for (const def of defs) {
      try {
        registry.register(def);
      } catch (error) {
        if (error instanceof AgentRegistryError) {
          throw new AgentLoaderError(
            `Cannot register agent "${def.id}" from ${file}: ${error.message}`,
            file,
            error,
          );
        }
        throw error;
      }
      loaded.push(def);
    }
  }
  return loaded;
}
