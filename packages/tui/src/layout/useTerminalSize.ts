import { createContext, useContext, useEffect, useState } from 'react';

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

export const DEFAULT_TERMINAL_SIZE: TerminalSize = {
  columns: 80,
  rows: 24,
};

export const SINGLE_COLUMN_THRESHOLD = 80;

const TerminalSizeContext = createContext<TerminalSize | null>(null);

export const TerminalSizeProvider = TerminalSizeContext.Provider;

export function useTerminalSize(): TerminalSize {
  const override = useContext(TerminalSizeContext);
  const [size, setSize] = useState<TerminalSize>(() => readStdoutSize());

  useEffect(() => {
    if (override) {
      return;
    }

    const stdout = process.stdout;
    if (!stdout) {
      return;
    }

    const update = () => {
      setSize(readStdoutSize());
    };

    stdout.on('resize', update);
    return () => {
      stdout.off('resize', update);
    };
  }, [override]);

  return override ?? size;
}

export function readStdoutSize(): TerminalSize {
  const stdout = process.stdout;
  const columns =
    stdout && typeof stdout.columns === 'number' && stdout.columns > 0
      ? stdout.columns
      : DEFAULT_TERMINAL_SIZE.columns;
  const rows =
    stdout && typeof stdout.rows === 'number' && stdout.rows > 0
      ? stdout.rows
      : DEFAULT_TERMINAL_SIZE.rows;
  return { columns, rows };
}

export function isNarrowTerminal(size: TerminalSize): boolean {
  return size.columns < SINGLE_COLUMN_THRESHOLD;
}
