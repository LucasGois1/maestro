import { describe, expect, it } from 'vitest';

import { PROVIDER_PACKAGE_NAME } from './index.js';

describe('@maestro/provider', () => {
  it('exports the package identifier', () => {
    expect(PROVIDER_PACKAGE_NAME).toBe('@maestro/provider');
  });
});
