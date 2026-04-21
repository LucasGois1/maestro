import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createTuiStore } from './store.js';
import { useStoreSelector } from './useStoreSelector.js';

describe('useStoreSelector', () => {
  it('renders the initial selected slice', () => {
    const store = createTuiStore({ mode: 'run' });

    function Probe() {
      const mode = useStoreSelector(store, (state) => state.mode);
      return <Text>{mode}</Text>;
    }

    const app = render(<Probe />);
    expect(app.lastFrame()).toContain('run');
    app.unmount();
  });

  it('re-renders only when the selected slice changes', () => {
    const store = createTuiStore();
    const renderSpy = vi.fn();

    function Probe() {
      const status = useStoreSelector(store, (state) => state.pipeline.status);
      renderSpy(status);
      return <Text>{status}</Text>;
    }

    const app = render(<Probe />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.setState((state) => ({
        ...state,
        agent: { ...state.agent, lastDelta: 'ignored' },
      }));
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.setState((state) => ({
        ...state,
        pipeline: { ...state.pipeline, status: 'running' },
      }));
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(app.lastFrame()).toContain('running');
    app.unmount();
  });

  it('honors a custom equality function', () => {
    const store = createTuiStore();
    const renderSpy = vi.fn();

    function Probe() {
      const sprintIds = useStoreSelector(
        store,
        (state) => state.sprints.map((sprint) => sprint.idx),
        {
          equalityFn: (a, b) =>
            a.length === b.length &&
            a.every((value, index) => value === b[index]),
        },
      );
      renderSpy(sprintIds.join(','));
      return <Text>{sprintIds.join(',')}</Text>;
    }

    const app = render(<Probe />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => {
      store.setState((state) => ({
        ...state,
        sprints: [{ idx: 1, status: 'running', retries: 0 }],
      }));
    });
    act(() => {
      store.setState((state) => ({
        ...state,
        sprints: [{ idx: 1, status: 'done', retries: 0 }],
      }));
    });

    expect(renderSpy).toHaveBeenCalledTimes(2);
    app.unmount();
  });
});
