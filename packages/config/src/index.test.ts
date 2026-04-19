import { describe, expect, it } from 'vitest';

import { CONFIG_PACKAGE_NAME } from './index.js';

describe('@maestro/config', () => {
  it('exports the package identifier', () => {
    expect(CONFIG_PACKAGE_NAME).toBe('@maestro/config');
  });
});
