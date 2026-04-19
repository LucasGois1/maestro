import { createPackageConfig } from '../../tsup.config.ts';

export default createPackageConfig({
  banner: {
    js: '#!/usr/bin/env node',
  },
  onSuccess: 'chmod +x dist/index.js',
});
