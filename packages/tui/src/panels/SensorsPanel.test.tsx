import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';

import { KeybindingProvider } from '../keybindings/index.js';

import { SensorsPanel } from './SensorsPanel.js';

function renderSensors(ui: ReactElement) {
  return render(
    <KeybindingProvider focusedPanelId="sensors" overlayOpen={false}>
      {ui}
    </KeybindingProvider>,
  );
}

describe('SensorsPanel', () => {
  it('shows a placeholder when no sensors are present', () => {
    const app = renderSensors(<SensorsPanel sensors={{}} />);
    expect(app.lastFrame()).toContain('no sensors reporting');
    app.unmount();
  });

  it('renders each sensor with id and status', () => {
    const app = renderSensors(
      <SensorsPanel
        sensors={{
          ruff: {
            sensorId: 'ruff',
            kind: 'computational',
            status: 'passed',
            message: null,
            durationMs: 12,
            onFail: 'block',
          },
          mypy: {
            sensorId: 'mypy',
            kind: 'computational',
            status: 'failed',
            message: 'types',
            durationMs: null,
            onFail: 'warn',
          },
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('ruff');
    expect(frame).toContain('mypy');
    expect(frame).toContain('passed');
    expect(frame).toContain('types');
    expect(frame).toContain('[C]');
    expect(frame).toContain('1 passed');
    expect(frame).toContain('1 failed');
    app.unmount();
  });
});
