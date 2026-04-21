import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createTuiStore } from '@maestro/tui';
import { describe, expect, it, vi } from 'vitest';

import { createTuiCommand, defaultRenderApp } from './tui.js';

describe('createTuiCommand', () => {
  it('renders the App without demo events by default', () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const startDemo = vi.fn();

    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: startDemo as never,
      env: {},
    });
    command.parse([], { from: 'user' });

    expect(renderApp).toHaveBeenCalledOnce();
    expect(startDemo).not.toHaveBeenCalled();
    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
    };
    expect(args.colorMode).toBe('color');
  });

  it('starts the demo when --demo is provided', () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const startDemo = vi.fn();

    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: startDemo as never,
      env: {},
    });
    command.parse(['--demo'], { from: 'user' });

    expect(startDemo).toHaveBeenCalledOnce();
  });

  it('honors --no-color and NO_COLOR', () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: vi.fn() as never,
      env: { NO_COLOR: '1' },
    });
    command.parse([], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
    };
    expect(args.colorMode).toBe('no-color');
  });

  it('forces no-color when --no-color flag is used', () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: vi.fn() as never,
      env: {},
    });
    command.parse(['--no-color'], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
    };
    expect(args.colorMode).toBe('no-color');
  });

  it('passes a shared bus that demo events feed into', () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: (bus: { emit(event: MaestroEvent): void }) => {
        bus.emit({ type: 'pipeline.started', runId: 'r1' });
      },
      env: {},
    });

    command.parse(['--demo'], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      store: { getState: () => { mode: string } };
    };
    expect(args.store.getState().mode).toBe('run');
  });

  it('defaultRenderApp renders an Ink instance and can unmount', () => {
    const bus = createEventBus();
    const store = createTuiStore({ colorMode: 'no-color' });
    const instance = defaultRenderApp({ store, bus, colorMode: 'no-color' });
    expect(typeof instance.unmount).toBe('function');
    instance.unmount();
  });
});
