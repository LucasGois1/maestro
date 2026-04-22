import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { SprintsPanel } from './SprintsPanel.js';

describe('SprintsPanel', () => {
  it('shows a placeholder when no sprints are scheduled', () => {
    const app = render(<SprintsPanel sprints={[]} />);

    expect(app.lastFrame()).toContain('no sprints scheduled');
    app.unmount();
  });

  it('lists sprints with numbered icons and statuses', () => {
    const app = render(
      <SprintsPanel
        sprints={[
          { idx: 1, status: 'done', retries: 0 },
          { idx: 2, status: 'running', retries: 0 },
          { idx: 3, status: 'pending', retries: 0 },
        ]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('#01 ✓ sprint 1 · done');
    expect(frame).toContain('#02 ⟳ sprint 2 · running');
    expect(frame).toContain('#03 ○ sprint 3 · pending');
    app.unmount();
  });

  it('renders retry indicator when retries > 0', () => {
    const app = render(
      <SprintsPanel sprints={[{ idx: 2, status: 'running', retries: 2 }]} />,
    );

    expect(app.lastFrame()).toContain('⟳2');
    app.unmount();
  });

  it('renders failed and escalated icons', () => {
    const app = render(
      <SprintsPanel
        sprints={[
          { idx: 1, status: 'failed', retries: 0 },
          { idx: 2, status: 'escalated', retries: 3 },
        ]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('#01 ✗ sprint 1 · failed');
    expect(frame).toContain('#02 ! sprint 2 · escalated');
    app.unmount();
  });

  it('highlights the selected sprint', () => {
    const app = render(
      <SprintsPanel
        sprints={[
          { idx: 1, status: 'done', retries: 0 },
          { idx: 2, status: 'running', retries: 0 },
        ]}
        selectedSprintIdx={2}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('sprint 2');
    app.unmount();
  });

  it('shows footer hint when focused', () => {
    const app = render(
      <SprintsPanel
        sprints={[{ idx: 1, status: 'running', retries: 0 }]}
        focused
      />,
    );

    expect(app.lastFrame()).toContain('Ver sprint → [N]');
    app.unmount();
  });

  it('suppresses ANSI colors in no-color mode', () => {
    const app = render(
      <SprintsPanel
        sprints={[
          { idx: 1, status: 'running', retries: 0 },
          { idx: 2, status: 'done', retries: 0 },
        ]}
        selectedSprintIdx={1}
        colorMode="no-color"
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).not.toContain('\u001B[');
    app.unmount();
  });
});
