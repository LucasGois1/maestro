import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';

import { ActiveAgentPanel } from './ActiveAgentPanel.js';

describe('ActiveAgentPanel', () => {
  it('renders header with active agent id', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel
        agent={{
          ...state.agent,
          activeAgentId: 'planner',
          messageLog: [
            { kind: 'delta', agentId: 'planner', at: 1, text: 'hello world' },
          ],
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Active Agent: planner');
    expect(frame).toContain('> hello world');
    app.unmount();
  });

  it('shows placeholder when there is no output', () => {
    const state = createInitialTuiState();
    const app = render(<ActiveAgentPanel agent={state.agent} />);

    expect(app.lastFrame()).toContain('(no output yet)');
    app.unmount();
  });

  it('renders decisions with star prefix and last decision footer', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel
        agent={{
          ...state.agent,
          activeAgentId: 'planner',
          decisions: [
            { agentId: 'planner', message: 'split into sprints', at: 10 },
          ],
          messageLog: [
            {
              kind: 'decision',
              agentId: 'planner',
              at: 10,
              text: 'split into sprints',
            },
          ],
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('★ split into sprints');
    expect(frame).toContain('última decisão: "split into sprints"');
    app.unmount();
  });

  it('renders tool_call entries with dedicated prefix', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel
        agent={{
          ...state.agent,
          activeAgentId: 'generator',
          messageLog: [
            {
              kind: 'tool_call',
              agentId: 'generator',
              at: 1,
              text: 'write_file',
            },
          ],
        }}
      />,
    );

    expect(app.lastFrame()).toContain('► write_file');
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

  it('truncates to maxLines entries', () => {
    const state = createInitialTuiState();
    const entries = Array.from({ length: 20 }, (_, i) => ({
      kind: 'delta' as const,
      agentId: 'gen',
      at: i,
      text: `line-${i.toString()}`,
    }));
    const app = render(
      <ActiveAgentPanel
        agent={{ ...state.agent, activeAgentId: 'gen', messageLog: entries }}
        maxLines={5}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('line-19');
    expect(frame).toContain('line-15');
    expect(frame).not.toContain('line-14');
    app.unmount();
  });

  it('shows [l] hint only when focused', () => {
    const state = createInitialTuiState();
    const withFocus = render(
      <ActiveAgentPanel agent={state.agent} focused />,
    );
    expect(withFocus.lastFrame()).toContain('[l] logs completos');
    withFocus.unmount();

    const withoutFocus = render(<ActiveAgentPanel agent={state.agent} />);
    expect(withoutFocus.lastFrame()).not.toContain('[l] logs completos');
    withoutFocus.unmount();
  });

  it('suppresses ANSI colors in no-color mode', () => {
    const state = createInitialTuiState();
    const app = render(
      <ActiveAgentPanel
        agent={{
          ...state.agent,
          activeAgentId: 'generator',
          messageLog: [
            {
              kind: 'decision',
              agentId: 'generator',
              at: 1,
              text: 'a decision',
            },
          ],
        }}
        colorMode="no-color"
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).not.toContain('\u001B[');
    app.unmount();
  });
});
