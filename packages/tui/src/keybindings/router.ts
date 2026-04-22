import type { TuiPanelId } from '../state/store.js';

export type KeybindingScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'panel'; readonly panelId: TuiPanelId }
  | { readonly kind: 'overlay' };

export interface KeybindingDescriptor {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}

export interface KeybindingRegistration {
  readonly scope: KeybindingScope;
  readonly binding: KeybindingDescriptor;
  readonly handler: () => void;
}

export interface KeybindingContext {
  readonly focusedPanelId: TuiPanelId;
  readonly overlayOpen: boolean;
}

export interface KeybindingMatch {
  readonly key: string;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

export interface KeybindingRouter {
  register(registration: KeybindingRegistration): () => void;
  dispatch(match: KeybindingMatch, context: KeybindingContext): boolean;
  list(): readonly KeybindingRegistration[];
}

export function createKeybindingRouter(): KeybindingRouter {
  const registrations = new Set<KeybindingRegistration>();

  return {
    register(registration) {
      registrations.add(registration);
      return () => {
        registrations.delete(registration);
      };
    },
    dispatch(match, context) {
      const active = Array.from(registrations).filter((registration) =>
        isScopeActive(registration.scope, context),
      );
      const priority = [
        pickByScopeKind(active, 'overlay'),
        pickByScopeKind(active, 'panel'),
        pickByScopeKind(active, 'global'),
      ];

      for (const pool of priority) {
        const hit = pool.find((registration) =>
          matchesBinding(registration.binding, match),
        );
        if (hit) {
          hit.handler();
          return true;
        }
      }
      return false;
    },
    list() {
      return Array.from(registrations);
    },
  };
}

export function normalizeMatch(
  match: Partial<KeybindingMatch> & { readonly key: string },
): KeybindingMatch {
  return {
    key: match.key,
    ctrl: match.ctrl ?? false,
    shift: match.shift ?? false,
    meta: match.meta ?? false,
  };
}

function isScopeActive(
  scope: KeybindingScope,
  context: KeybindingContext,
): boolean {
  switch (scope.kind) {
    case 'global':
      return true;
    case 'panel':
      return !context.overlayOpen && scope.panelId === context.focusedPanelId;
    case 'overlay':
      return context.overlayOpen;
  }
}

function pickByScopeKind(
  registrations: readonly KeybindingRegistration[],
  kind: KeybindingScope['kind'],
): readonly KeybindingRegistration[] {
  return registrations.filter(
    (registration) => registration.scope.kind === kind,
  );
}

function matchesBinding(
  binding: KeybindingDescriptor,
  match: KeybindingMatch,
): boolean {
  return (
    binding.key === match.key &&
    (binding.ctrl ?? false) === match.ctrl &&
    (binding.shift ?? false) === match.shift &&
    (binding.meta ?? false) === match.meta
  );
}
