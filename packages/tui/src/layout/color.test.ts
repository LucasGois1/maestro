import { describe, expect, it } from 'vitest';

import { resolveColorMode } from './color.js';

describe('resolveColorMode', () => {
  it('returns "color" by default', () => {
    expect(resolveColorMode()).toBe('color');
    expect(resolveColorMode({ args: [], env: {} })).toBe('color');
  });

  it('honours the --no-color flag', () => {
    expect(resolveColorMode({ args: ['--no-color'], env: {} })).toBe(
      'no-color',
    );
  });

  it('honours the --no-colors alias', () => {
    expect(resolveColorMode({ args: ['--no-colors'], env: {} })).toBe(
      'no-color',
    );
  });

  it('honours the NO_COLOR env variable when non-empty', () => {
    expect(resolveColorMode({ args: [], env: { NO_COLOR: '1' } })).toBe(
      'no-color',
    );
  });

  it('ignores empty NO_COLOR env variable values', () => {
    expect(resolveColorMode({ args: [], env: { NO_COLOR: '' } })).toBe(
      'color',
    );
  });

  it('prefers the CLI flag when both are present', () => {
    expect(
      resolveColorMode({ args: ['--no-color'], env: { NO_COLOR: '' } }),
    ).toBe('no-color');
  });
});
