import { useInput } from 'ink';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import type { TuiPanelId } from '../state/store.js';

import {
  createKeybindingRouter,
  normalizeMatch,
  type KeybindingMatch,
  type KeybindingRouter,
} from './router.js';

export interface KeybindingContextValue {
  readonly router: KeybindingRouter;
  readonly focusedPanelId: TuiPanelId;
  readonly overlayOpen: boolean;
}

const KeybindingContextReact = createContext<KeybindingContextValue | null>(null);

export interface KeybindingProviderProps {
  readonly focusedPanelId: TuiPanelId;
  readonly overlayOpen: boolean;
  readonly router?: KeybindingRouter;
  readonly children: ReactNode;
  readonly enabled?: boolean;
}

export function KeybindingProvider({
  focusedPanelId,
  overlayOpen,
  router: injectedRouter,
  children,
  enabled = true,
}: KeybindingProviderProps) {
  const router = useMemo(
    () => injectedRouter ?? createKeybindingRouter(),
    [injectedRouter],
  );

  const contextValue = useMemo<KeybindingContextValue>(
    () => ({ router, focusedPanelId, overlayOpen }),
    [router, focusedPanelId, overlayOpen],
  );

  useInput(
    (input, key) => {
      const match = normalizeMatchFromInk(input, key);
      if (!match) {
        return;
      }
      router.dispatch(match, { focusedPanelId, overlayOpen });
    },
    { isActive: enabled },
  );

  return (
    <KeybindingContextReact.Provider value={contextValue}>
      {children}
    </KeybindingContextReact.Provider>
  );
}

export function useKeybindingContext(): KeybindingContextValue {
  const value = useContext(KeybindingContextReact);
  if (!value) {
    throw new Error(
      'useKeybindingContext must be used inside a <KeybindingProvider>',
    );
  }
  return value;
}

interface InkKey {
  readonly upArrow?: boolean;
  readonly downArrow?: boolean;
  readonly leftArrow?: boolean;
  readonly rightArrow?: boolean;
  readonly return?: boolean;
  readonly escape?: boolean;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
  readonly tab?: boolean;
  readonly backspace?: boolean;
  readonly delete?: boolean;
  readonly pageUp?: boolean;
  readonly pageDown?: boolean;
  readonly home?: boolean;
  readonly end?: boolean;
}

function normalizeMatchFromInk(
  input: string,
  key: InkKey,
): KeybindingMatch | null {
  const named = detectNamedKey(key);
  if (named) {
    return normalizeMatch({
      key: named,
      ctrl: key.ctrl ?? false,
      shift: key.shift ?? false,
      meta: key.meta ?? false,
    });
  }

  if (input.length === 0) {
    return null;
  }

  return normalizeMatch({
    key: input,
    ctrl: key.ctrl ?? false,
    shift: key.shift ?? false,
    meta: key.meta ?? false,
  });
}

function detectNamedKey(key: InkKey): string | null {
  if (key.escape) return 'escape';
  if (key.return) return 'return';
  if (key.tab) return 'tab';
  if (key.upArrow) return 'up';
  if (key.downArrow) return 'down';
  if (key.leftArrow) return 'left';
  if (key.rightArrow) return 'right';
  if (key.pageUp) return 'pageup';
  if (key.pageDown) return 'pagedown';
  if (key.home) return 'home';
  if (key.end) return 'end';
  if (key.backspace) return 'backspace';
  if (key.delete) return 'delete';
  return null;
}
