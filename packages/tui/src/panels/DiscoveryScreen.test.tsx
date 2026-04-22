import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { KeybindingProvider } from '../keybindings/index.js';
import { TerminalSizeProvider } from '../layout/useTerminalSize.js';
import {
  createInitialTuiState,
  createTuiStore,
  type TuiDiscoveryState,
  type TuiState,
} from '../state/store.js';
import { DiscoveryScreen } from './DiscoveryScreen.js';

function renderDiscovery(
  state: Partial<TuiState> & { readonly discovery: TuiDiscoveryState },
  onChoice = vi.fn(),
) {
  const store = createTuiStore(state);
  return {
    onChoice,
    app: render(
      <TerminalSizeProvider value={{ columns: 100, rows: 36 }}>
        <KeybindingProvider focusedPanelId="diff" overlayOpen={false}>
          <DiscoveryScreen store={store} onChoice={onChoice} />
        </KeybindingProvider>
      </TerminalSizeProvider>,
    ),
  };
}

function discovery(overrides: Partial<TuiDiscoveryState>): TuiDiscoveryState {
  return {
    ...createInitialTuiState().discovery,
    ...overrides,
  };
}

describe('DiscoveryScreen', () => {
  it('renders inferring progress, provider metadata, and live model output', () => {
    const { app } = renderDiscovery({
      colorMode: 'no-color',
      discovery: discovery({
        phase: 'inferring',
        providerSummary: 'openai · gpt-test',
        progressHint: 'Sampling repository files',
        stackSummary: 'TypeScript monorepo',
        structureSummary: 'packages/tui and packages/agents',
        agentStreamTail: `line one\n${'x'.repeat(160)}`,
      }),
    });

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Discovery · inferring documentation');
    expect(frame).toContain('Provider: openai · gpt-test');
    expect(frame).toContain('Sampling repository files');
    expect(frame).toContain('Stack: TypeScript monorepo');
    expect(frame).toContain('Live model output');
    expect(frame).toContain('sensors.json');
    app.unmount();
  });

  it('renders a preview diff and accepts it with Enter', async () => {
    const { app, onChoice } = renderDiscovery({
      colorMode: 'no-color',
      discovery: discovery({ phase: 'preview' }),
      diffPreview: {
        ...createInitialTuiState().diffPreview,
        activePath: '.maestro/AGENTS.md',
        unifiedDiff: '+Use Maestro testing strategy',
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Preview');
    expect(frame).toContain('.maestro/AGENTS.md');
    expect(frame).toContain('+Use Maestro testing strategy');

    app.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChoice).toHaveBeenCalledWith('accept');
    app.unmount();
  });

  it('renders errors and maps Enter to cancel', async () => {
    const { app, onChoice } = renderDiscovery({
      colorMode: 'color',
      discovery: discovery({
        phase: 'error',
        errorSummary: 'Discovery failed',
        errorDetail: 'Provider request rejected',
        logFilePath: '.maestro/logs/discovery.log',
      }),
    });

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Discovery failed');
    expect(frame).toContain('Provider request rejected');
    expect(frame).toContain('.maestro/logs/discovery.log');

    app.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChoice).toHaveBeenCalledWith('cancel');
    app.unmount();
  });

  it('ignores Enter before choices are available', async () => {
    const { app, onChoice } = renderDiscovery({
      colorMode: 'no-color',
      discovery: discovery({ phase: 'detecting' }),
    });

    expect(app.lastFrame()).toContain('Scan running');
    app.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChoice).not.toHaveBeenCalled();
    app.unmount();
  });
});
