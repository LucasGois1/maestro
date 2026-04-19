import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { HelloWorld } from './HelloWorld.js';

describe('HelloWorld', () => {
  it('renders the hello message with the current version', () => {
    const app = render(<HelloWorld version="0.0.1" />);

    expect(app.lastFrame()).toContain('Hello from Maestro · v0.0.1');
    app.unmount();
  });
});
