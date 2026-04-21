import { createPackageVitestConfig } from '../../vitest.config.ts';

const baseConfig = createPackageVitestConfig(import.meta.dirname);

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
};
