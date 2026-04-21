import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { KeybindingProvider } from './KeybindingProvider.js';
import { createKeybindingRouter } from './router.js';
import { useKeybinding } from './useKeybinding.js';

describe('KeybindingProvider', () => {
  it('dispatches global bindings on keypress', async () => {
    const handler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'global' }, { key: 'q' }, handler);
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
    app.stdin.write('q');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).toHaveBeenCalled();
    app.unmount();
  });

  it('dispatches overlay bindings when overlay is open', async () => {
    const handler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'overlay' }, { key: 'escape' }, handler);
      return <Text>ready</Text>;
    }

    const app = render(
      <KeybindingProvider
        focusedPanelId="pipeline"
        overlayOpen={true}
        router={router}
      >
        <Probe />
      </KeybindingProvider>,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    app.stdin.write('\u001b');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(handler).toHaveBeenCalled();
    app.unmount();
  });

  it('respects the enabled flag on useKeybinding', async () => {
    const handler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'global' }, { key: 'x' }, handler, {
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
    app.stdin.write('x');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handler).not.toHaveBeenCalled();
    app.unmount();
  });

  it('only activates panel bindings for the focused panel', async () => {
    const pipelineHandler = vi.fn();
    const sensorHandler = vi.fn();
    const router = createKeybindingRouter();

    function Probe() {
      useKeybinding({ kind: 'panel', panelId: 'pipeline' }, { key: 'r' }, pipelineHandler);
      useKeybinding({ kind: 'panel', panelId: 'sensors' }, { key: 'r' }, sensorHandler);
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
    app.stdin.write('r');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pipelineHandler).toHaveBeenCalled();
    expect(sensorHandler).not.toHaveBeenCalled();
    app.unmount();
  });
});
