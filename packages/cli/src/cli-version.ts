import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** CLI package version (shown in the TUI home screen). */
export const CLI_PACKAGE_VERSION = (
  require('../package.json') as { version: string }
).version;
