import { describe, expect, it } from 'vitest';

import { SENSORS_PACKAGE_NAME } from './index.js';

describe('@maestro/sensors', () => {
  it('exports the package identifier', () => {
    expect(SENSORS_PACKAGE_NAME).toBe('@maestro/sensors');
  });
});
