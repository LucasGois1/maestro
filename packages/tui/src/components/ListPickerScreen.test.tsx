import { render } from 'ink-testing-library';
import { describe, expect, it, vi } from 'vitest';

import { TerminalSizeProvider } from '../layout/useTerminalSize.js';
import { ListPickerScreen } from './ListPickerScreen.js';

const items = [
  { key: 'provider-openai', title: 'OpenAI', subtitle: 'Fast default' },
  { key: 'provider-local', title: 'Local model', dimmed: true },
  { key: 'skip', title: 'Skip setup' },
];

function renderPicker(onConfirm = vi.fn(), initialIndex = 99) {
  return {
    onConfirm,
    app: render(
      <TerminalSizeProvider value={{ columns: 100, rows: 30 }}>
        <ListPickerScreen
          title="Choose provider"
          description="Select a provider for discovery."
          items={items}
          initialIndex={initialIndex}
          colorMode="no-color"
          onConfirm={onConfirm}
        />
      </TerminalSizeProvider>,
    ),
  };
}

describe('ListPickerScreen', () => {
  it('renders title, description, clamped selection, and item subtitles', () => {
    const { app } = renderPicker();

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Choose provider');
    expect(frame).toContain('Select a provider for discovery.');
    expect(frame).toContain('Fast default');
    expect(frame).toContain('› Skip setup');
    app.unmount();
  });

  it('skips and does not confirm dimmed items', async () => {
    const { app, onConfirm } = renderPicker(vi.fn(), 1);

    app.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onConfirm).not.toHaveBeenCalled();

    app.stdin.write('q');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onConfirm).toHaveBeenCalledWith(items[2], 2);
    app.unmount();
  });
});
