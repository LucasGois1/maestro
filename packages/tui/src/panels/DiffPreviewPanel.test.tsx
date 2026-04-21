import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { DiffPreviewPanel } from './DiffPreviewPanel.js';

describe('DiffPreviewPanel', () => {
  it('shows the current mode in the title', () => {
    const app = render(
      <DiffPreviewPanel diffPreview={{ mode: 'diff' }} />,
    );
    expect(app.lastFrame()).toContain('Diff · Preview · Feedback (diff)');
    app.unmount();
  });

  it('shows a description per mode', () => {
    const app = render(
      <DiffPreviewPanel diffPreview={{ mode: 'preview' }} />,
    );
    expect(app.lastFrame()).toContain(
      'formatted preview of the artifact',
    );
    app.unmount();
  });

  it('references the follow-up epic in the footer', () => {
    const app = render(
      <DiffPreviewPanel diffPreview={{ mode: 'feedback' }} />,
    );
    expect(app.lastFrame()).toContain('DSFT-88');
    app.unmount();
  });
});
