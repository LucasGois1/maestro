import { useCallback, useRef, useSyncExternalStore } from 'react';

import type { TuiState, TuiStore } from './store.js';

export interface UseStoreSelectorOptions<T> {
  readonly equalityFn?: (a: T, b: T) => boolean;
}

export function useStoreSelector<T>(
  store: TuiStore,
  selector: (state: TuiState) => T,
  options: UseStoreSelectorOptions<T> = {},
): T {
  const equalityFn = options.equalityFn ?? Object.is;
  const cachedRef = useRef<{ readonly value: T } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  const getSnapshot = useCallback(() => {
    const next = selector(store.getState());
    if (cachedRef.current !== null && equalityFn(cachedRef.current.value, next)) {
      return cachedRef.current.value;
    }
    cachedRef.current = { value: next };
    return next;
  }, [equalityFn, selector, store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
