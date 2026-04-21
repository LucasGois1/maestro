import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { Footer, deriveFooterState } from './Footer.js';

describe('Footer', () => {
  it('renders idle hotkeys by default', () => {
    const app = render(<Footer state="idle" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[i] init');
    expect(frame).toContain('[r] run');
    expect(frame).toContain('[q] quit');
    app.unmount();
  });

  it('renders running hotkeys with pause', () => {
    const app = render(<Footer state="running" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[p] pause');
    expect(frame).toContain('[c] cancel');
    app.unmount();
  });

  it('renders paused hotkeys with resume', () => {
    const app = render(<Footer state="paused" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[space] resume');
    app.unmount();
  });

  it('renders overlay hotkeys (close/navigate/select)', () => {
    const app = render(<Footer state="overlay" />);
    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[esc] close');
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
