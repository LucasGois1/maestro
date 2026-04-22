import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { KeybindingProvider } from '../keybindings/index.js';

import { FeedbackHistoryOverlay } from './FeedbackHistoryOverlay.js';

function entry(at: number, attempt: number, failure: string, criterion = 'c') {
  return {
    at,
    sprintIdx: 1 as number | null,
    attempt,
    criterion,
    failure,
    file: null,
    line: null,
    suggestedAction: null,
  };
}

describe('FeedbackHistoryOverlay', () => {
  it('shows delta between consecutive attempts when two entries exist', () => {
    const app = render(
      <KeybindingProvider focusedPanelId="pipeline" overlayOpen>
        <FeedbackHistoryOverlay
          entries={[
            entry(1, 1, 'line a\nline b'),
            entry(2, 2, 'line a\nline c'),
          ]}
        />
      </KeybindingProvider>,
    );
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Δ entre tentativas');
    expect(frame).toContain('só na seguinte');
    expect(frame).toContain('line c');
    app.unmount();
  });
});
