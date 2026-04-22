import { useEffect, useState } from 'react';

const DEFAULT_FRAMES = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏',
] as const;

export type UseSpinnerFrameOptions = {
  readonly enabled: boolean;
  readonly intervalMs?: number;
};

/**
 * Braille spinner for “something is in flight” without blocking stdin.
 */
export function useSpinnerFrame(options: UseSpinnerFrameOptions): string {
  const { enabled, intervalMs = 100 } = options;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setIndex(0);
      return;
    }
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % DEFAULT_FRAMES.length);
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [enabled, intervalMs]);

  if (!enabled) {
    return '';
  }
  return DEFAULT_FRAMES[index % DEFAULT_FRAMES.length] ?? '⠋';
}
