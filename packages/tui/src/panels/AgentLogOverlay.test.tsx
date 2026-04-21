import { render } from 'ink-testing-library';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { KeybindingProvider } from '../keybindings/KeybindingProvider.js';
import { createInitialTuiState } from '../state/store.js';

import {
  AGENT_LOG_OVERLAY_ID,
  AgentLogOverlay,
  createAgentLogOverlay,
} from './AgentLogOverlay.js';

function withOverlayKeybindings(node: ReactNode) {
  return (
    <KeybindingProvider focusedPanelId="pipeline" overlayOpen>
      {node}
    </KeybindingProvider>
  );
}

describe('AgentLogOverlay', () => {
  it('shows a placeholder when messageLog is empty', () => {
    const state = createInitialTuiState();
    const app = render(
      withOverlayKeybindings(<AgentLogOverlay agent={state.agent} />),
    );

    expect(app.lastFrame()).toContain('(log vazio)');
    app.unmount();
  });

  it('renders header, delta, tool_call and decision entries', () => {
    const state = createInitialTuiState();
    const app = render(
      withOverlayKeybindings(
        <AgentLogOverlay
          agent={{
            ...state.agent,
            activeAgentId: 'generator',
            messageLog: [
              { kind: 'delta', agentId: 'generator', at: 1, text: 'token' },
              {
                kind: 'tool_call',
                agentId: 'generator',
                at: 2,
                text: 'write_file',
              },
              {
                kind: 'decision',
                agentId: 'generator',
                at: 3,
                text: 'retry sprint',
              },
            ],
          }}
        />,
      ),
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('active: generator');
    expect(frame).toContain('shown 3/3');
    expect(frame).toContain('> [generator] token');
    expect(frame).toContain('► [generator] write_file');
    expect(frame).toContain('★ [generator] retry sprint');
    app.unmount();
  });

  it('createAgentLogOverlay returns a stack entry with the right id and title', () => {
    const state = createInitialTuiState();
    const overlay = createAgentLogOverlay(state.agent, 'color');
    expect(overlay.id).toBe(AGENT_LOG_OVERLAY_ID);
    expect(overlay.title).toBe('Logs completos');
    const rendered = overlay.render();
    expect(rendered).toBeDefined();
  });
});
