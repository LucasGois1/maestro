import { createEventBus } from '@maestro/core';
import { render } from 'ink-testing-library';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App.js';
import { createTuiStore } from './state/store.js';

const SIZE_WIDE = { columns: 120, rows: 40 } as const;
const SIZE_NARROW = { columns: 60, rows: 24 } as const;

describe('App', () => {
  it('renders header, all five panels, and footer in idle mode', () => {
    const app = render(<App terminalSize={SIZE_WIDE} />);

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('maestro');
    expect(frame).toContain('maestro ›');
    expect(frame).toContain('Pipeline');
    expect(frame).toContain('Active Agent');
    expect(frame).toContain('Sprints');
    expect(frame).toContain('Sensores');
    expect(frame).toContain('Diff · Preview · Feedback');
    expect(frame).toContain('[?]');
    expect(frame).toContain('help');
    app.unmount();
  });

  it('submits a TUI command through the command input', async () => {
    const bus = createEventBus();
    const commandExecutor = vi.fn(async ({ input }) => {
      bus.emit({ type: 'pipeline.started', runId: 'r-command' });
      return { level: 'info' as const, message: `executed ${input}` };
    });
    const app = render(
      <App
        bus={bus}
        terminalSize={SIZE_WIDE}
        commandExecutor={commandExecutor}
      />,
    );

    app.stdin.write('run ship auth\r');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(commandExecutor).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'run ship auth' }),
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('executed run ship auth');
    expect(frame).toContain('run');
    app.unmount();
  });

  it('suggests known commands and rejects unknown free text', async () => {
    const commandExecutor = vi.fn();
    const app = render(
      <App terminalSize={SIZE_WIDE} commandExecutor={commandExecutor} />,
    );

    app.stdin.write('ru');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(app.lastFrame()).toContain('run <prompt>');

    app.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(app.lastFrame()).toContain('maestro › run');

    app.stdin.write('\u0015not a command\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(commandExecutor).not.toHaveBeenCalled();
    expect(app.lastFrame()).toContain('Unknown command');
    app.unmount();
  });

  it('recalls executed commands from history with arrow keys', async () => {
    const commandExecutor = vi.fn(async ({ input }) => ({
      level: 'info' as const,
      message: `executed ${input}`,
    }));
    const app = render(
      <App terminalSize={SIZE_WIDE} commandExecutor={commandExecutor} />,
    );

    app.stdin.write('run ship auth\r');
    await new Promise((resolve) => setTimeout(resolve, 20));
    app.stdin.write('\u001b[A');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(app.lastFrame()).toContain('maestro › run ship auth');
    app.stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(app.lastFrame()).toContain('maestro ›');
    app.unmount();
  });

  it('disables the command input while an overlay is open', async () => {
    const commandExecutor = vi.fn();
    const app = render(
      <App
        terminalSize={SIZE_WIDE}
        commandExecutor={commandExecutor}
        initialOverlay={{
          id: 'help',
          title: 'Help',
          render: () => null,
        }}
      />,
    );

    app.stdin.write('run ship auth\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(commandExecutor).not.toHaveBeenCalled();
    expect(app.lastFrame()).toContain('maestro › (overlay open)');
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
    expect(frame).toContain('⟳ Generating');
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
      'Sensores',
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
    const app = render(<App terminalSize={SIZE_WIDE} colorMode="no-color" />);
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

  it('selects a sprint when digit keys are pressed on the sprints panel', async () => {
    const store = createTuiStore();
    const bus = createEventBus();
    const app = render(
      <App store={store} bus={bus} terminalSize={SIZE_WIDE} />,
    );

    act(() => {
      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 1,
        totalSprints: 2,
      });
      bus.emit({
        type: 'pipeline.sprint_started',
        runId: 'r',
        sprintIdx: 2,
        totalSprints: 2,
      });
    });

    act(() => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: 'sprints' },
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    app.stdin.write('2');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.getState().focus.selectedSprintIdx).toBe(2);
    app.unmount();
  });

  it('ignores digit keys when target sprint does not exist', async () => {
    const store = createTuiStore();
    const app = render(<App store={store} terminalSize={SIZE_WIDE} />);

    act(() => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: 'sprints' },
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    app.stdin.write('5');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(store.getState().focus.selectedSprintIdx).toBeNull();
    app.unmount();
  });

  it('opens the agent log overlay with [l] when activeAgent is focused', async () => {
    const store = createTuiStore();
    const app = render(<App store={store} terminalSize={SIZE_WIDE} />);

    act(() => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: 'activeAgent' },
        agent: {
          ...state.agent,
          activeAgentId: 'gen',
          messageLog: [{ kind: 'delta', agentId: 'gen', at: 1, text: 'hi' }],
        },
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    app.stdin.write('l');
    await new Promise((resolve) => setTimeout(resolve, 20));

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Logs completos');
    app.unmount();
  });

  it('keeps the pipeline panel with 7 stages under rapid updates (non-flicker)', () => {
    const store = createTuiStore();
    const bus = createEventBus();
    const app = render(
      <App store={store} bus={bus} terminalSize={SIZE_WIDE} />,
    );

    act(() => {
      const stages = [
        'discovering',
        'planning',
        'architecting',
        'contracting',
        'generating',
        'evaluating',
        'merging',
      ] as const;
      bus.emit({ type: 'pipeline.started', runId: 'r' });
      for (const stage of stages) {
        bus.emit({
          type: 'pipeline.stage_entered',
          runId: 'r',
          stage,
        });
        bus.emit({
          type: 'agent.delta',
          agentId: 'gen',
          runId: 'r',
          chunk: `${stage}-x`,
        });
      }
    });

    const frame = app.lastFrame() ?? '';
    for (const label of [
      'Discovering',
      'Planning',
      'Architecting',
      'Contracting',
      'Generating',
      'Evaluating',
      'Merging',
    ]) {
      expect(frame).toContain(label);
    }
    app.unmount();
  });

  it('opens sensors detail overlay with [s] when sensors panel is focused', async () => {
    const store = createTuiStore();
    const app = render(<App store={store} terminalSize={SIZE_WIDE} />);

    act(() => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: 'sensors' },
        sensors: {
          ruff: {
            sensorId: 'ruff',
            kind: 'computational',
            status: 'passed',
            message: null,
            durationMs: 5,
            onFail: 'block',
            stdout: null,
            stderr: null,
            violations: [],
          },
        },
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    app.stdin.write('s');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(app.lastFrame()).toContain('Sensores — detalhe');
    app.unmount();
  });

  it('opens feedback history overlay with [r] when diff panel is focused', async () => {
    const store = createTuiStore();
    const app = render(<App store={store} terminalSize={SIZE_WIDE} />);

    act(() => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: 'diff' },
        diffPreview: {
          ...state.diffPreview,
          feedbackHistory: [
            {
              at: 1,
              sprintIdx: null,
              attempt: 1,
              criterion: 'c',
              failure: 'f',
              file: 'a.ts',
              line: 2,
              suggestedAction: null,
            },
          ],
        },
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    app.stdin.write('r');
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(app.lastFrame()).toContain('Feedback — histórico');
    app.unmount();
  });
});
