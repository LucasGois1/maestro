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
    expect(resolveCliMode(['config', 'get', 'permissions.mode'])).toBe(
      'command',
    );
  });

  it('stays in app mode for unknown first args', () => {
    expect(resolveCliMode(['some-prompt'])).toBe('app');
  });

  it('routes tui as a known subcommand', () => {
    expect(resolveCliMode(['tui'])).toBe('command');
    expect(resolveCliMode(['tui', '--demo'])).toBe('command');
  });

  it('routes background as a known subcommand', () => {
    expect(resolveCliMode(['background', 'run'])).toBe('command');
    expect(resolveCliMode(['background', 'run', '--skip-llm'])).toBe('command');
  });

  it('routes init as a known subcommand', () => {
    expect(resolveCliMode(['init'])).toBe('command');
    expect(resolveCliMode(['init', '--no-ai'])).toBe('command');
  });
});
