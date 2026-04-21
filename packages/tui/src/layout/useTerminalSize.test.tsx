import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TERMINAL_SIZE,
  SINGLE_COLUMN_THRESHOLD,
  TerminalSizeProvider,
  isNarrowTerminal,
  readStdoutSize,
  useTerminalSize,
} from './useTerminalSize.js';

describe('useTerminalSize', () => {
  it('returns the value provided by TerminalSizeProvider', () => {
    function Probe() {
      const size = useTerminalSize();
      return (
        <Text>{`cols=${size.columns.toString()} rows=${size.rows.toString()}`}</Text>
      );
    }

    const app = render(
      <TerminalSizeProvider value={{ columns: 72, rows: 20 }}>
        <Probe />
      </TerminalSizeProvider>,
    );

    expect(app.lastFrame()).toContain('cols=72 rows=20');
    app.unmount();
  });

  it('falls back to stdout size when no provider is present', () => {
    function Probe() {
      const size = useTerminalSize();
      return <Text>{`cols=${size.columns.toString()}`}</Text>;
    }

    const app = render(<Probe />);
    const frame = app.lastFrame() ?? '';

    expect(frame).toMatch(/cols=\d+/);
    app.unmount();
  });
});

describe('readStdoutSize', () => {
  it('returns a positive columns/rows pair', () => {
    const size = readStdoutSize();
    expect(size.columns).toBeGreaterThan(0);
    expect(size.rows).toBeGreaterThan(0);
  });
});

describe('isNarrowTerminal', () => {
  it('reports narrow when columns are under the threshold', () => {
    expect(isNarrowTerminal({ columns: SINGLE_COLUMN_THRESHOLD - 1, rows: 24 })).toBe(
      true,
    );
  });

  it('reports not narrow when columns match the threshold', () => {
    expect(isNarrowTerminal({ columns: SINGLE_COLUMN_THRESHOLD, rows: 24 })).toBe(
      false,
    );
  });
});

describe('DEFAULT_TERMINAL_SIZE', () => {
  it('defaults to an 80x24 terminal', () => {
    expect(DEFAULT_TERMINAL_SIZE).toEqual({ columns: 80, rows: 24 });
  });
});
