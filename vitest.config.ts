import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { coverageConfigDefaults, defineConfig } from 'vitest/config';

const workspaceRoot = path.dirname(fileURLToPath(import.meta.url));

const workspacePackageAliases = [
  'agents',
  'config',
  'contract',
  'core',
  'discovery',
  'git',
  'kb',
  'pipeline',
  'provider',
  'sandbox',
  'sensors',
  'state',
  'testkit',
  'tui',
].map((packageName) => ({
  find: `@maestro/${packageName}`,
  replacement: path.join(
    workspaceRoot,
    'packages',
    packageName,
    'src',
    'index.ts',
  ),
}));

export function createPackageVitestConfig(packageDirectory: string) {
  const packageName = path.basename(packageDirectory);

  return defineConfig({
    resolve: {
      alias: workspacePackageAliases,
    },
    test: {
      environment: 'node',
      globals: true,
      passWithNoTests: true,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['dist', 'node_modules'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: path.join(workspaceRoot, 'coverage', packageName),
        thresholds: {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
        exclude: [
          ...coverageConfigDefaults.exclude,
          'src/**/*.test.ts',
          'src/**/*.test.tsx',
          'src/**/*.spec.ts',
          'src/**/*.spec.tsx',
        ],
      },
    },
  });
}

export default defineConfig({
  resolve: {
    alias: workspacePackageAliases,
  },
  test: {
    passWithNoTests: true,
  },
});
