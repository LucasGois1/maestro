import { describe, expect, it } from 'vitest';

import { AGENTS_PACKAGE_NAME } from './index.js';

describe('@maestro/agents', () => {
  it('exports the package identifier', () => {
    expect(AGENTS_PACKAGE_NAME).toBe('@maestro/agents');
  });
});
