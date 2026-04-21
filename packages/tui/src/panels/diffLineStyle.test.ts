import { describe, expect, it } from 'vitest';

import { diffLineInkProps, sliceDiffWindow } from './diffLineStyle.js';

describe('diffLineStyle', () => {
  it('colors diff prefixes when color is enabled', () => {
    expect(diffLineInkProps('+x', true)).toMatchObject({ color: 'green' });
    expect(diffLineInkProps('-x', true)).toMatchObject({ color: 'red' });
    expect(diffLineInkProps('@@ x', true)).toMatchObject({ color: 'cyan' });
    expect(diffLineInkProps(' context', true)).toMatchObject({ dimColor: true });
  });

  it('returns plain props in no-color mode', () => {
    expect(diffLineInkProps('+x', false)).toEqual({});
  });

  it('slices a diff window', () => {
    const text = 'a\nb\nc\nd\ne';
    const { lines, totalLines } = sliceDiffWindow(text, 1, 2);
    expect(totalLines).toBe(5);
    expect(lines).toEqual(['b', 'c']);
  });

  it('handles large diffs by windowing only (performance)', () => {
    const many = Array.from({ length: 1000 }, (_, i) => `+line ${i.toString()}`).join(
      '\n',
    );
    const { lines, totalLines } = sliceDiffWindow(many, 0, 32);
    expect(totalLines).toBe(1000);
    expect(lines).toHaveLength(32);
  });
});
