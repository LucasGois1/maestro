import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import {
  OverlayHost,
  OverlayHostProvider,
  useOverlayHost,
} from './OverlayHost.js';

describe('OverlayHost', () => {
  it('renders nothing when no overlays are pushed', () => {
    const app = render(
      <OverlayHostProvider>
        <OverlayHost />
      </OverlayHostProvider>,
    );
    expect(app.lastFrame() ?? '').toBe('');
    app.unmount();
  });

  it('pushes, renders the top overlay, and pops it via hook', () => {
    let api: ReturnType<typeof useOverlayHost> | null = null;

    function Probe() {
      api = useOverlayHost();
      return <Text>ready</Text>;
    }

    const app = render(
      <OverlayHostProvider>
        <OverlayHost />
        <Probe />
      </OverlayHostProvider>,
    );

    act(() => {
      api?.push({
        id: 'help',
        title: 'Help',
        render: () => <Text>help content</Text>,
      });
    });

    expect(app.lastFrame()).toContain('Help');
    expect(app.lastFrame()).toContain('help content');

    act(() => {
      api?.push({
        id: 'command',
        title: 'Command Palette',
        render: () => <Text>palette content</Text>,
      });
    });

    expect(app.lastFrame()).toContain('Command Palette');
    expect(app.lastFrame()).toContain('palette content');
    expect(app.lastFrame()).not.toContain('help content');

    act(() => {
      api?.pop();
    });

    expect(app.lastFrame()).toContain('Help');
    expect(app.lastFrame()).toContain('help content');

    act(() => {
      api?.pop();
    });

    const finalFrame = app.lastFrame() ?? '';
    expect(finalFrame).not.toContain('Help');
    expect(finalFrame).not.toContain('Command Palette');
    expect(finalFrame).toContain('ready');
    app.unmount();
  });

  it('clear removes every overlay in the stack', () => {
    let api: ReturnType<typeof useOverlayHost> | null = null;

    function Probe() {
      api = useOverlayHost();
      return <Text>ready</Text>;
    }

    const app = render(
      <OverlayHostProvider>
        <OverlayHost />
        <Probe />
      </OverlayHostProvider>,
    );

    act(() => {
      api?.push({ id: 'a', title: 'A', render: () => <Text>a</Text> });
      api?.push({ id: 'b', title: 'B', render: () => <Text>b</Text> });
    });

    act(() => {
      api?.clear();
    });

    const frame = app.lastFrame() ?? '';
    expect(frame).not.toContain('A ');
    expect(frame).not.toContain('B ');
    expect(frame).toContain('ready');
    app.unmount();
  });

  it('calls onChange with the new stack', () => {
    const changes: number[] = [];
    let api: ReturnType<typeof useOverlayHost> | null = null;

    function Probe() {
      api = useOverlayHost();
      return <Text>ready</Text>;
    }

    const app = render(
      <OverlayHostProvider
        onChange={(overlays) => {
          changes.push(overlays.length);
        }}
      >
        <Probe />
      </OverlayHostProvider>,
    );

    act(() => {
      api?.push({ id: 'a', title: 'A', render: () => null });
    });
    act(() => {
      api?.pop();
    });

    expect(changes).toEqual([1, 0]);
    app.unmount();
  });
});
