import { Text } from 'ink';
import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { Panel } from './Panel.js';

describe('Panel', () => {
  it('renders the title and a placeholder body', () => {
    const app = render(<Panel title="Pipeline" />);

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Pipeline');
    expect(frame).toContain('—');
    app.unmount();
  });

  it('shows focused marker when focused', () => {
    const app = render(<Panel title="Pipeline" focused />);
    const focused = app.lastFrame() ?? '';

    const app2 = render(<Panel title="Pipeline" focused={false} />);
    const unfocused = app2.lastFrame() ?? '';

    expect(focused).toContain('◉');
    expect(unfocused).toContain('○');

    app.unmount();
    app2.unmount();
  });

  it('suppresses ANSI colors in no-color mode', () => {
    const app = render(
      <Panel title="Pipeline" focused colorMode="no-color">
        <Text>content</Text>
      </Panel>,
    );

    // eslint-disable-next-line no-control-regex
    const ansiRegex = /\u001B\[/;
    const frame = app.lastFrame() ?? '';
    expect(ansiRegex.test(frame)).toBe(false);
    expect(frame).toContain('Pipeline');
    app.unmount();
  });

  it('renders an optional footer hint', () => {
    const app = render(<Panel title="Sensors" footerHint="p pause · r retry" />);
    expect(app.lastFrame()).toContain('p pause · r retry');
    app.unmount();
  });
});
