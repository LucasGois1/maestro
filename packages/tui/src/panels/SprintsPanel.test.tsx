import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { SprintsPanel } from './SprintsPanel.js';

describe('SprintsPanel', () => {
  it('shows a placeholder when no sprints are scheduled', () => {
    const app = render(<SprintsPanel sprints={[]} />);

    expect(app.lastFrame()).toContain('no sprints scheduled');
    app.unmount();
  });

  it('lists sprints with status and retries', () => {
    const app = render(
      <SprintsPanel
        sprints={[
          { idx: 1, status: 'done', retries: 0 },
          { idx: 2, status: 'running', retries: 1 },
        ]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('#01 · done · retries 0');
    expect(frame).toContain('#02 · running · retries 1');
    app.unmount();
  });
});
