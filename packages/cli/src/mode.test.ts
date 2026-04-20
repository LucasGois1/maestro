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

  it('routes known subcommands to commander', () => {
    expect(resolveCliMode(['config', 'list'])).toBe('command');
    expect(resolveCliMode(['config', 'get', 'permissions.mode'])).toBe('command');
  });

  it('stays in app mode for unknown first args', () => {
    expect(resolveCliMode(['some-prompt'])).toBe('app');
  });
});
