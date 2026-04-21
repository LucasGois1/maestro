import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { SensorsPanel } from './SensorsPanel.js';

describe('SensorsPanel', () => {
  it('shows a placeholder when no sensors are present', () => {
    const app = render(<SensorsPanel sensors={{}} />);
    expect(app.lastFrame()).toContain('no sensors reporting');
    app.unmount();
  });

  it('renders each sensor with id and status', () => {
    const app = render(
      <SensorsPanel
        sensors={{
          ruff: {
            sensorId: 'ruff',
            kind: 'computational',
            status: 'passed',
            message: null,
          },
          mypy: {
            sensorId: 'mypy',
            kind: 'computational',
            status: 'failed',
            message: 'types',
          },
        }}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('ruff');
    expect(frame).toContain('mypy');
    expect(frame).toContain('passed');
    expect(frame).toContain('types');
    app.unmount();
  });
});
