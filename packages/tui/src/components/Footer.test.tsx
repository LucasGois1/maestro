import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { Footer, deriveFooterState } from './Footer.js';

describe('Footer', () => {
  it('renders nothing for idle pipeline footer (hints moved elsewhere)', () => {
    const app = render(<Footer state="idle" />);
    expect(app.lastFrame() ?? '').toBe('');
    app.unmount();
  });

  it('renders nothing for running pipeline footer', () => {
    const app = render(<Footer state="running" />);
    expect(app.lastFrame() ?? '').toBe('');
    app.unmount();
  });

  it('renders nothing for paused pipeline footer', () => {
    const app = render(<Footer state="paused" />);
    expect(app.lastFrame() ?? '').toBe('');
    app.unmount();
  });

  it('renders transient message when provided', () => {
    const app = render(
      <Footer
        state="idle"
        transientMessage="Press Control-C again to exit"
      />,
    );
    expect(app.lastFrame()).toContain('Press Control-C again to exit');
    app.unmount();
  });

  it('renders overlay hotkeys (close/navigate/select)', () => {
    const app = render(<Footer state="overlay" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[esc] close');
    expect(frame).toContain('[q] close');
    expect(frame).toContain('[enter] select');
    app.unmount();
  });
});

describe('deriveFooterState', () => {
  it('returns overlay when overlay is open regardless of pipeline', () => {
    expect(deriveFooterState('running', true)).toBe('overlay');
    expect(deriveFooterState('idle', true)).toBe('overlay');
  });

  it('maps pipeline states to footer states', () => {
    expect(deriveFooterState('running', false)).toBe('running');
    expect(deriveFooterState('paused', false)).toBe('paused');
    expect(deriveFooterState('idle', false)).toBe('idle');
    expect(deriveFooterState('completed', false)).toBe('idle');
    expect(deriveFooterState('failed', false)).toBe('idle');
  });
});
