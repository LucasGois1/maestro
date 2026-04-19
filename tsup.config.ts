import { defineConfig, type Options } from 'tsup';

const isProductionBuild = process.env.NODE_ENV === 'production';

export function createPackageConfig(overrides: Options = {}) {
  return defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm'],
    platform: 'node',
    target: 'node24',
    dts: true,
    sourcemap: true,
    clean: true,
    minify: isProductionBuild,
    ...overrides,
  });
}
