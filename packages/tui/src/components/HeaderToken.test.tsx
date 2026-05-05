import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';
import { Header } from './Header.js';

describe('Header token total', () => {
  it('renders token total when provided', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="run"
        header={{
          ...state.header,
          repoName: 'acme',
          branch: 'main',
          totalTokens: 60000,
        }}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('· tokens 60000');
    app.unmount();
  });

  it('renders additional token total with higher value', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="run"
        header={{
          ...state.header,
          repoName: 'acme',
          branch: 'main',
          totalTokens: 120000,
        }}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('· tokens 120000');
    app.unmount();
  });

  it('does not render token total when null', () => {
    const state = createInitialTuiState();
    const app = render(
      <Header
        mode="run"
        header={{
          ...state.header,
          repoName: 'acme',
          branch: 'main',
          totalTokens: null,
        }}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).not.toContain('tokens');
    app.unmount();
  });
});
