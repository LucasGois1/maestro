import { describe, expect, it } from 'vitest';

import { resolveCliMode } from './mode.ts';

describe('resolveCliMode', () => {
  it('defaults to the interactive app', () => {
    expect(resolveCliMode([])).toBe('app');
  });

  it('detects the version flag', () => {
    expect(resolveCliMode(['--version'])).toBe('version');
  });

  it('detects the help flag', () => {
    expect(resolveCliMode(['--help'])).toBe('help');
  });
});
