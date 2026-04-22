import { createPackageVitestConfig } from '../../vitest.config.ts';

const baseConfig = createPackageVitestConfig(import.meta.dirname);

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseConfig.test.coverage,
      exclude: [...(baseConfig.test.coverage?.exclude ?? []), 'src/engine.ts'],
    },
  },
};
