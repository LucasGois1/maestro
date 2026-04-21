import { useEffect } from 'react';

import { useKeybindingContext } from './KeybindingProvider.js';
import type { KeybindingDescriptor, KeybindingScope } from './router.js';

export interface UseKeybindingOptions {
  readonly enabled?: boolean;
}

export function useKeybinding(
  scope: KeybindingScope,
  binding: KeybindingDescriptor,
  handler: () => void,
  options: UseKeybindingOptions = {},
): void {
  const enabled = options.enabled ?? true;
  const context = useKeybindingContext();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const unregister = context.router.register({
      scope,
      binding,
      handler,
    });
    return unregister;
  }, [context.router, enabled, scope, binding, handler]);
}
