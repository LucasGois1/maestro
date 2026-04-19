import { describe, expect, it } from 'vitest';

import { TUI_PACKAGE_NAME, formatHelloMessage } from './index.js';

describe('@maestro/tui', () => {
  it('re-exports the package identifier and formatter', () => {
    expect(TUI_PACKAGE_NAME).toBe('@maestro/tui');
    expect(formatHelloMessage('0.0.1')).toBe('Hello from Maestro · v0.0.1');
  });
});
