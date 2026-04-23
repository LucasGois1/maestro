import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSpinnerFrame } from './useSpinnerFrame.js';
import React from 'react';

function SpinnerProbe(props: { readonly enabled: boolean }) {
  const frame = useSpinnerFrame({ enabled: props.enabled, intervalMs: 50 });
  return <Text>{frame.length > 0 ? frame : '_'}</Text>;
}

describe('useSpinnerFrame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty when disabled', () => {
    const app = render(<SpinnerProbe enabled={false} />);
    expect(app.lastFrame()).toBe('_');
    app.unmount();
  });

  it('cycles frames when enabled', async () => {
    const app = render(<SpinnerProbe enabled />);
    const first = app.lastFrame() ?? '';
    expect(first).not.toBe('_');
    await vi.advanceTimersByTimeAsync(200);
    const second = app.lastFrame() ?? '';
    expect(second).not.toBe(first);
    app.unmount();
  });
});
