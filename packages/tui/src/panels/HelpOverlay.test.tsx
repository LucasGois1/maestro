import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HelpOverlay } from './HelpOverlay.js';

describe('HelpOverlay', () => {
  it('lists global and panel hotkey sections', () => {
    const app = render(<HelpOverlay colorMode="no-color" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Global');
    expect(frame).toContain('[tab]');
    expect(frame).toContain('When panel focused');
    expect(frame).toContain('[l]');
    expect(frame).toContain('[k]');
    expect(frame).toContain('[e]');
    app.unmount();
  });
});
