import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { DiscoveryPhaseChecklist } from './DiscoveryPhaseChecklist.js';

describe('DiscoveryPhaseChecklist', () => {
  it('marks the current phase while discovery is running', () => {
    const app = render(
      <DiscoveryPhaseChecklist phase="structuring" colorMode="no-color" />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[✓] Detect stack');
    expect(frame).toContain('[⟳] Analyse structure');
    expect(frame).toContain('[·] Infer AGENTS.md');
    app.unmount();
  });

  it('marks infer failures in the error phase', () => {
    const app = render(
      <DiscoveryPhaseChecklist phase="error" colorMode="color" />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('[!] Infer AGENTS.md');
    expect(frame).toContain('[·] Preview & apply');
    app.unmount();
  });
});
