import { describe, expect, it } from 'vitest';

import { DISCOVERY_PACKAGE_NAME } from './index.js';

describe('@maestro/discovery', () => {
  it('exports package name', () => {
    expect(DISCOVERY_PACKAGE_NAME).toBe('@maestro/discovery');
  });
});
