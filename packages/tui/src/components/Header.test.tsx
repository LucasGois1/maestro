import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';

import { Header } from './Header.js';

describe('Header', () => {
  it('renders the idle mode by default', () => {
    const state = createInitialTuiState();
    const app = render(<Header mode="idle" header={state.header} />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('maestro');
    expect(frame).toContain('idle');
    app.unmount();
  });

  it('shows discovery mode and repo/branch', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="discovery"
        header={{
          ...state.header,
          repoName: 'maestro',
          branch: 'main',
        }}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('maestro');
    expect(frame).toContain('main');
    expect(frame).toContain('discovery');
    app.unmount();
  });

  it('shows run mode with sprint and context info', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="run"
        header={{
          ...state.header,
          repoName: 'acme',
          branch: 'feature/x',
          sprintIdx: 2,
          totalSprints: 4,
          contextPct: 37,
        }}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('run');
    expect(frame).toContain('sprint 2/4');
    expect(frame).toContain('ctx 37%');
    app.unmount();
  });

  it('renders the update available badge when flag is set', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="idle"
        header={{ ...state.header, updateAvailable: true }}
      />,
    );
    expect(app.lastFrame()).toContain('update available');
    app.unmount();
  });

  it('truncates long branch names with an ellipsis', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="idle"
        header={{
          ...state.header,
          branch: 'feature/very-long-branch-name-that-does-not-fit',
        }}
        maxBranchLength={12}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('feature/ver…');
    expect(frame).not.toContain('branch-name-that');
    app.unmount();
  });
});
