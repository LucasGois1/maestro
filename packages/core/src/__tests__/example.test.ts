import { describe, expect, it } from 'vitest';

import { CORE_PACKAGE_NAME } from '../index.js';

describe('@maestro/core', () => {
  it('exports the package identifier', () => {
    expect(CORE_PACKAGE_NAME).toBe('@maestro/core');
  });
});
