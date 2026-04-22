import { Box, Text } from 'ink';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import type { TuiColorMode } from '../state/store.js';

export interface OverlayDefinition {
  readonly id: string;
  readonly title: string;
  readonly render: () => ReactNode;
}

export interface OverlayHostApi {
  readonly overlays: readonly OverlayDefinition[];
  readonly push: (overlay: OverlayDefinition) => void;
  readonly pop: () => void;
  readonly clear: () => void;
  readonly topId: string | null;
}

const OverlayHostContext = createContext<OverlayHostApi | null>(null);

export interface OverlayHostProviderProps {
  readonly initialStack?: readonly OverlayDefinition[];
  readonly onChange?: (overlays: readonly OverlayDefinition[]) => void;
  readonly children: ReactNode;
}

export function OverlayHostProvider({
  initialStack = [],
  onChange,
  children,
}: OverlayHostProviderProps) {
  const [stack, setStack] =
    useState<readonly OverlayDefinition[]>(initialStack);

  const emit = useCallback(
    (next: readonly OverlayDefinition[]) => {
      onChange?.(next);
      setStack(next);
    },
    [onChange],
  );

  const push = useCallback(
    (overlay: OverlayDefinition) => {
      emit([...stack, overlay]);
    },
    [emit, stack],
  );

  const pop = useCallback(() => {
    if (stack.length === 0) {
      return;
    }
    emit(stack.slice(0, -1));
  }, [emit, stack]);

  const clear = useCallback(() => {
    emit([]);
  }, [emit]);

  const api = useMemo<OverlayHostApi>(
    () => ({
      overlays: stack,
      push,
      pop,
      clear,
      topId: stack.length > 0 ? (stack[stack.length - 1]?.id ?? null) : null,
    }),
    [stack, push, pop, clear],
  );

  return (
    <OverlayHostContext.Provider value={api}>
      {children}
    </OverlayHostContext.Provider>
  );
}

export function useOverlayHost(): OverlayHostApi {
  const value = useContext(OverlayHostContext);
  if (!value) {
    throw new Error('useOverlayHost must be used inside <OverlayHostProvider>');
  }
  return value;
}

export interface OverlayHostProps {
  readonly colorMode?: TuiColorMode;
}

export function OverlayHost({ colorMode = 'color' }: OverlayHostProps) {
  const { overlays } = useOverlayHost();
  const useColor = colorMode === 'color';
  const top = overlays[overlays.length - 1];
  if (!top) {
    return null;
  }
  return (
    <Box
      borderStyle="double"
      borderColor={useColor ? 'magenta' : undefined}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold {...(useColor ? { color: 'magenta' } : {})}>
        {`▌ ${top.title}`}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {top.render()}
      </Box>
    </Box>
  );
}
