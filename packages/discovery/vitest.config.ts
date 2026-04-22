import { createPackageVitestConfig } from '../../vitest.config.ts';

const baseConfig = createPackageVitestConfig(import.meta.dirname);

export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    coverage: {
      ...baseConfig.test.coverage,
      exclude: [
        ...(baseConfig.test.coverage?.exclude ?? []),
        'src/apply-draft.ts',
        'src/orchestrator.ts',
        'src/refresh.ts',
        'src/greenfield.ts',
        'src/sampling.ts',
        'src/state.ts',
        'src/stack-detector.ts',
        'src/structural-analyzer.ts',
        'src/types.ts',
      ],
    },
  },
};
