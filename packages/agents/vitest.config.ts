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
        'src/*-tools.ts',
        'src/runner.ts',
        'src/run-sensor-tool.ts',
        'src/doc-gardener/background-git.ts',
        'src/doc-gardener/execute-background.ts',
        'src/doc-gardener/detect-code-drift.ts',
        'src/doc-gardener/detect-package-health.ts',
        'src/doc-gardener/detect-stale-docs.ts',
        'src/doc-gardener/open-pr-category.ts',
        'src/merger/infer-labels.ts',
        'src/planner/normalize.ts',
        'src/planner/planner-output.schema.ts',
      ],
    },
  },
};
