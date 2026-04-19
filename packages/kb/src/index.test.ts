import { describe, expect, it } from 'vitest';

import { KB_PACKAGE_NAME } from './index.js';

describe('@maestro/kb', () => {
  it('exports the package identifier', () => {
    expect(KB_PACKAGE_NAME).toBe('@maestro/kb');
  });
});
