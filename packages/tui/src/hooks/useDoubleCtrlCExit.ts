import { useCallback, useEffect, useRef } from 'react';
import type { Key } from 'ink';

export type DoubleCtrlCExitHandlers = {
  readonly onArm: () => void;
  readonly onExit: () => void;
};

/**
 * Handles double Control+C within 2s to exit (same semantics as CommandInput).
 * Returns a handler for useInput; returns true when the key was consumed.
 */
export function useDoubleCtrlCExit(
  handlers: DoubleCtrlCExitHandlers | undefined,
): {
  readonly tryHandleCtrlC: (ch: string, key: Key) => boolean;
} {
  const ctrlCArmAtRef = useRef<number | null>(null);
  const ctrlCArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (ctrlCArmTimerRef.current !== null) {
        clearTimeout(ctrlCArmTimerRef.current);
        ctrlCArmTimerRef.current = null;
      }
    };
  }, []);

  const tryHandleCtrlC = useCallback(
    (ch: string, key: Key): boolean => {
      if (handlers === undefined) {
        return false;
      }
      if (!(key.ctrl && ch === 'c')) {
        return false;
      }
      const now = Date.now();
      if (
        ctrlCArmAtRef.current !== null &&
        now - ctrlCArmAtRef.current <= 2000
      ) {
        if (ctrlCArmTimerRef.current !== null) {
          clearTimeout(ctrlCArmTimerRef.current);
          ctrlCArmTimerRef.current = null;
        }
        ctrlCArmAtRef.current = null;
        handlers.onExit();
        return true;
      }
      ctrlCArmAtRef.current = now;
      handlers.onArm();
      if (ctrlCArmTimerRef.current !== null) {
        clearTimeout(ctrlCArmTimerRef.current);
      }
      ctrlCArmTimerRef.current = setTimeout(() => {
        ctrlCArmAtRef.current = null;
        ctrlCArmTimerRef.current = null;
      }, 2000);
      return true;
    },
    [handlers],
  );

  return { tryHandleCtrlC };
}
