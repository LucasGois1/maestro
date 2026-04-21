import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { KeybindingProvider } from './KeybindingProvider.js';
import { createKeybindingRouter, normalizeMatch } from './router.js';
import { useKeybinding } from './useKeybinding.js';

describe('useKeybinding', () => {
  it('registers on mount and unregisters on unmount', async () => {
    const handler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'global' }, { key: 'j' }, handler);
      return <Text>ready</Text>;
    }

    const app = render(
      <KeybindingProvider
        focusedPanelId="pipeline"
        overlayOpen={false}
        router={router}
      >
        <Probe />
      </KeybindingProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.list()).toHaveLength(1);

    app.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.list()).toHaveLength(0);
  });

  it('does not register when enabled is false', async () => {
    const handler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'global' }, { key: 'y' }, handler, {
        enabled: false,
      });
      return <Text>ready</Text>;
    }

    const app = render(
      <KeybindingProvider
        focusedPanelId="pipeline"
        overlayOpen={false}
        router={router}
      >
        <Probe />
      </KeybindingProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(router.list()).toHaveLength(0);
    router.dispatch(normalizeMatch({ key: 'y' }), {
      focusedPanelId: 'pipeline',
      overlayOpen: false,
    });
    expect(handler).not.toHaveBeenCalled();
    app.unmount();
  });
});
