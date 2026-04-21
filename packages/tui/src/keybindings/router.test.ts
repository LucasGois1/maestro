import { describe, expect, it, vi } from 'vitest';

import { createKeybindingRouter, normalizeMatch } from './router.js';

describe('createKeybindingRouter', () => {
  it('dispatches global bindings when no panel-local match exists', () => {
    const router = createKeybindingRouter();
    const handler = vi.fn();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'q' },
      handler,
    });

    const handled = router.dispatch(normalizeMatch({ key: 'q' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });

    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('prefers panel-local bindings over global when panel is focused', () => {
    const router = createKeybindingRouter();
    const globalHandler = vi.fn();
    const panelHandler = vi.fn();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'd' },
      handler: globalHandler,
    });
    router.register({
      scope: { kind: 'panel', panelId: 'sensors' },
      binding: { key: 'd' },
      handler: panelHandler,
    });

    router.dispatch(normalizeMatch({ key: 'd' }), {
      focusedPanelId: 'sensors',
      overlayOpen: false,
    });

    expect(panelHandler).toHaveBeenCalledOnce();
    expect(globalHandler).not.toHaveBeenCalled();
  });

  it('falls back to global when the focused panel has no binding', () => {
    const router = createKeybindingRouter();
    const globalHandler = vi.fn();
    const panelHandler = vi.fn();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'd' },
      handler: globalHandler,
    });
    router.register({
      scope: { kind: 'panel', panelId: 'sensors' },
      binding: { key: 'd' },
      handler: panelHandler,
    });

    router.dispatch(normalizeMatch({ key: 'd' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });

    expect(globalHandler).toHaveBeenCalledOnce();
    expect(panelHandler).not.toHaveBeenCalled();
  });

  it('overlay bindings take precedence and suppress panel bindings', () => {
    const router = createKeybindingRouter();
    const overlayHandler = vi.fn();
    const panelHandler = vi.fn();
    router.register({
      scope: { kind: 'overlay' },
      binding: { key: 'escape' },
      handler: overlayHandler,
    });
    router.register({
      scope: { kind: 'panel', panelId: 'pipeline' },
      binding: { key: 'escape' },
      handler: panelHandler,
    });

    router.dispatch(normalizeMatch({ key: 'escape' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: true,
    });

    expect(overlayHandler).toHaveBeenCalledOnce();
    expect(panelHandler).not.toHaveBeenCalled();
  });

  it('still dispatches global bindings while an overlay is open', () => {
    const router = createKeybindingRouter();
    const globalHandler = vi.fn();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'q' },
      handler: globalHandler,
    });

    router.dispatch(normalizeMatch({ key: 'q' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: true,
    });

    expect(globalHandler).toHaveBeenCalledOnce();
  });

  it('matches modifiers strictly', () => {
    const router = createKeybindingRouter();
    const handler = vi.fn();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'c', ctrl: true },
      handler,
    });

    const plainMiss = router.dispatch(normalizeMatch({ key: 'c' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });
    expect(plainMiss).toBe(false);

    const hit = router.dispatch(normalizeMatch({ key: 'c', ctrl: true }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });
    expect(hit).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns false when no binding matches', () => {
    const router = createKeybindingRouter();
    const handled = router.dispatch(normalizeMatch({ key: 'x' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });
    expect(handled).toBe(false);
  });

  it('unregister removes the binding', () => {
    const router = createKeybindingRouter();
    const handler = vi.fn();
    const unregister = router.register({
      scope: { kind: 'global' },
      binding: { key: 'q' },
      handler,
    });

    unregister();

    const handled = router.dispatch(normalizeMatch({ key: 'q' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });

    expect(handled).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('list returns all active registrations', () => {
    const router = createKeybindingRouter();
    router.register({
      scope: { kind: 'global' },
      binding: { key: 'a' },
      handler: () => undefined,
    });
    router.register({
      scope: { kind: 'panel', panelId: 'pipeline' },
      binding: { key: 'b' },
      handler: () => undefined,
    });

    expect(router.list()).toHaveLength(2);
  });
});
