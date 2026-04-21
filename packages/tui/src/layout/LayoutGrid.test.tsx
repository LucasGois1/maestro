import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { LayoutGrid } from './LayoutGrid.js';
import { TerminalSizeProvider } from './useTerminalSize.js';

const SLOTS = {
  pipeline: <Text>[pipeline]</Text>,
  activeAgent: <Text>[activeAgent]</Text>,
  sprints: <Text>[sprints]</Text>,
  sensors: <Text>[sensors]</Text>,
  diff: <Text>[diff]</Text>,
};

describe('LayoutGrid', () => {
  it('renders all five slots at wide widths', () => {
    const app = render(
      <TerminalSizeProvider value={{ columns: 120, rows: 40 }}>
        <LayoutGrid slots={SLOTS} />
      </TerminalSizeProvider>,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[pipeline]');
    expect(frame).toContain('[activeAgent]');
    expect(frame).toContain('[sprints]');
    expect(frame).toContain('[sensors]');
    expect(frame).toContain('[diff]');

    app.unmount();
  });

  it('renders at exactly 80 columns using the multi-column layout', () => {
    const app = render(
      <TerminalSizeProvider value={{ columns: 80, rows: 24 }}>
        <LayoutGrid slots={SLOTS} />
      </TerminalSizeProvider>,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[pipeline]');
    expect(frame).toContain('[activeAgent]');
    expect(frame).toContain('[sprints]');

    app.unmount();
  });

  it('degrades to a single column below 80 columns', () => {
    const app = render(
      <TerminalSizeProvider value={{ columns: 60, rows: 24 }}>
        <LayoutGrid slots={SLOTS} />
      </TerminalSizeProvider>,
    );

    const frame = app.lastFrame() ?? '';
    const order = ['[pipeline]', '[activeAgent]', '[sprints]', '[sensors]', '[diff]']
      .map((token) => frame.indexOf(token));

    expect(order.every((index) => index >= 0)).toBe(true);
    for (let i = 1; i < order.length; i += 1) {
      const current = order[i];
      const previous = order[i - 1];
      if (current === undefined || previous === undefined) {
        throw new Error('order slot missing');
      }
      expect(current).toBeGreaterThan(previous);
    }

    app.unmount();
  });

  it('also degrades at 79 columns (just below the threshold)', () => {
    const app = render(
      <TerminalSizeProvider value={{ columns: 79, rows: 24 }}>
        <LayoutGrid slots={SLOTS} />
      </TerminalSizeProvider>,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[pipeline]');
    expect(frame).toContain('[diff]');
    app.unmount();
  });
});
