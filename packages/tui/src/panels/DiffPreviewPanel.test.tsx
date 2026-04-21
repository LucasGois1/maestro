import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { KeybindingProvider } from '../keybindings/index.js';
import type { TuiDiffPreviewState } from '../state/store.js';

import { DiffPreviewPanel } from './DiffPreviewPanel.js';

function renderDiff(ui: ReactElement) {
  return render(
    <KeybindingProvider focusedPanelId="diff" overlayOpen={false}>
      {ui}
    </KeybindingProvider>,
  );
}

function baseDiff(overrides: Partial<TuiDiffPreviewState> = {}): TuiDiffPreviewState {
  return {
    mode: 'diff',
    activePath: null,
    unifiedDiff: '',
    changedPaths: [],
    activeIndex: 0,
    diffByPath: {},
    feedback: null,
    feedbackHistory: [],
    ...overrides,
  };
}

describe('DiffPreviewPanel', () => {
  it('shows the current mode in the title', () => {
    const app = renderDiff(<DiffPreviewPanel diffPreview={baseDiff()} />);
    expect(app.lastFrame()).toContain('Diff · Preview · Feedback (diff)');
    app.unmount();
  });

  it('renders preview placeholder in v0.1', () => {
    const app = renderDiff(
      <DiffPreviewPanel diffPreview={baseDiff({ mode: 'preview' })} />,
    );
    expect(app.lastFrame()).toContain('v0.3');
    app.unmount();
  });

  it('renders feedback fields when present', () => {
    const app = renderDiff(
      <DiffPreviewPanel
        diffPreview={baseDiff({
          mode: 'feedback',
          feedback: {
            at: 1,
            sprintIdx: 1,
            attempt: 2,
            criterion: 'tests pass',
            failure: 'assertion failed',
            file: 'a.ts',
            line: 9,
            suggestedAction: 'fix mock',
          },
        })}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('tests pass');
    expect(frame).toContain('assertion failed');
    expect(frame).toContain('a.ts:9');
    app.unmount();
  });

  it('renders unified diff lines with path header', () => {
    const app = renderDiff(
      <DiffPreviewPanel
        diffPreview={baseDiff({
          activePath: 'src/x.ts',
          unifiedDiff: '+added\n-removed',
        })}
      />,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('src/x.ts');
    expect(frame).toContain('+added');
    app.unmount();
  });
});
