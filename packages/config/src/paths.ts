import { homedir } from 'node:os';
import { join } from 'node:path';

export const CONFIG_FILE_NAME = 'config.json';
export const MAESTRO_DIR_NAME = '.maestro';

export type ConfigPaths = {
  readonly global: string;
  readonly project: string;
};

export type ResolveConfigPathsOptions = {
  readonly cwd?: string;
  readonly home?: string;
};

export function resolveConfigPaths(options: ResolveConfigPathsOptions = {}): ConfigPaths {
  const home = options.home ?? homedir();
  const cwd = options.cwd ?? process.cwd();

  return {
    global: join(home, MAESTRO_DIR_NAME, CONFIG_FILE_NAME),
    project: join(cwd, MAESTRO_DIR_NAME, CONFIG_FILE_NAME),
  };
}
