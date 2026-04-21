import { render } from 'ink-testing-library';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import type { TuiSensorState } from '../state/store.js';
import { KeybindingProvider } from '../keybindings/index.js';

import { SensorsPanel } from './SensorsPanel.js';

function sensorFixture(
  partial: Omit<TuiSensorState, 'stdout' | 'stderr' | 'violations'> &
    Partial<Pick<TuiSensorState, 'stdout' | 'stderr' | 'violations'>>,
): TuiSensorState {
  return {
    ...partial,
    stdout: partial.stdout ?? null,
    stderr: partial.stderr ?? null,
    violations: partial.violations ?? [],
  };
}

function SensorsHarness({
  sensors,
}: {
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
}) {
  const [focusedSensorId, setFocusedSensorId] = useState<string | null>(null);
  return (
    <SensorsPanel
      sensors={sensors}
      focusedSensorId={focusedSensorId}
      onFocusedSensorIdChange={setFocusedSensorId}
    />
  );
}

function renderSensors(ui: ReactElement) {
  return render(
    <KeybindingProvider focusedPanelId="sensors" overlayOpen={false}>
      {ui}
    </KeybindingProvider>,
  );
}

describe('SensorsPanel', () => {
  it('shows a placeholder when no sensors are present', () => {
    const app = renderSensors(
      <SensorsPanel
        sensors={{}}
        focusedSensorId={null}
        onFocusedSensorIdChange={() => {
          /* noop */
        }}
      />,
    );
    expect(app.lastFrame()).toContain('no sensors reporting');
    app.unmount();
  });

  it('renders each sensor with id and status', () => {
    const app = renderSensors(
      <SensorsHarness
        sensors={{
          ruff: sensorFixture({
            sensorId: 'ruff',
            kind: 'computational',
            status: 'passed',
            message: null,
            durationMs: 12,
            onFail: 'block',
          }),
          mypy: sensorFixture({
            sensorId: 'mypy',
            kind: 'computational',
            status: 'failed',
            message: 'types',
            durationMs: null,
            onFail: 'warn',
          }),
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
