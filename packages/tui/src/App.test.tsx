import { createEventBus } from '@maestro/core';
import { render } from 'ink-testing-library';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { App } from './App.js';
import { createTuiStore } from './state/store.js';

const SIZE_WIDE = { columns: 120, rows: 40 } as const;
const SIZE_NARROW = { columns: 60, rows: 24 } as const;

describe('App', () => {
  it('renders header, all five panels, and footer in idle mode', () => {
    const app = render(<App terminalSize={SIZE_WIDE} />);

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('maestro');
    expect(frame).toContain('Pipeline');
    expect(frame).toContain('Active Agent');
    expect(frame).toContain('Sprints');
    expect(frame).toContain('Sensors');
    expect(frame).toContain('Diff · Preview · Feedback');
    expect(frame).toContain('[i] init');
    app.unmount();
  });

  it('reflects pipeline run state via the EventBus bridge', () => {
    const store = createTuiStore();
    const bus = createEventBus();
    const app = render(
      <App store={store} bus={bus} terminalSize={SIZE_WIDE} />,
    );

    act(() => {
      bus.emit({ type: 'pipeline.started', runId: 'r1' });
      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r1',
        sprintIdx: 2,
        totalSprints: 4,
      });
      bus.emit({
        type: 'pipeline.stage_entered',
        runId: 'r1',
        stage: 'generating',
        sprintIdx: 2,
      });
    });

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('run');
    expect(frame).toContain('sprint 2/4');
    expect(frame).toContain('stage: generating');
    expect(frame).toContain('[p] pause');
    app.unmount();
  });

  it('degrades into a single-column layout below 80 columns', () => {
    const app = render(<App terminalSize={SIZE_NARROW} />);
    const frame = app.lastFrame() ?? '';

    const order = [
      'Pipeline',
      'Active Agent',
      'Sprints',
      'Sensors',
      'Diff · Preview · Feedback',
    ].map((token) => frame.indexOf(token));

    expect(order.every((index) => index >= 0)).toBe(true);
    for (let i = 1; i < order.length; i += 1) {
      const current = order[i];
      const previous = order[i - 1];
      if (current === undefined || previous === undefined) {
        throw new Error('order slot missing');
      }
      expect(current).toBeGreaterThan(previous);
    }
    app.unmount();
  });

  it('renders without ANSI escape codes when colorMode is no-color', () => {
    const app = render(
      <App terminalSize={SIZE_WIDE} colorMode="no-color" />,
    );
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\u001B\[/;
    expect(ansiRegex.test(app.lastFrame() ?? '')).toBe(false);
    app.unmount();
  });

  it('shows an overlay when initialOverlay is provided', () => {
    const app = render(
      <App
        terminalSize={SIZE_WIDE}
        initialOverlay={{
          id: 'help',
          title: 'Help',
          render: () => null,
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Help');
    expect(frame).toContain('[esc] close');
    app.unmount();
  });

  it('cycles focus through panels with Tab and Shift+Tab', async () => {
    const store = createTuiStore();
    const app = render(<App store={store} terminalSize={SIZE_WIDE} />);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.getState().focus.panelId).toBe('pipeline');

    app.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().focus.panelId).toBe('activeAgent');

    app.stdin.write('\t');
    app.stdin.write('\t');
    app.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().focus.panelId).toBe('diff');

    app.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().focus.panelId).toBe('pipeline');

    app.stdin.write('\u001b[Z');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().focus.panelId).toBe('diff');

    app.unmount();
  });
});
