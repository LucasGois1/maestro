import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';

import { ActiveAgentPanel } from './ActiveAgentPanel.js';

describe('ActiveAgentPanel', () => {
  it('renders agent identity and decision count', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel
        agent={{
          ...state.agent,
          activeAgentId: 'planner',
          lastDelta: 'hello',
          decisions: [{ agentId: 'planner', message: 'go', at: 0 }],
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('agent: planner');
    expect(frame).toContain('1 decision(s)');
    expect(frame).toContain('hello');
    app.unmount();
  });

  it('shows placeholder when there is no output', () => {
    const state = createInitialTuiState();
    const app = render(<ActiveAgentPanel agent={state.agent} />);

    expect(app.lastFrame()).toContain('(no output yet)');
    app.unmount();
  });

  it('surfaces errors', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel agent={{ ...state.agent, error: 'crash' }} />,
    );

    expect(app.lastFrame()).toContain('error: crash');
    app.unmount();
  });
});
