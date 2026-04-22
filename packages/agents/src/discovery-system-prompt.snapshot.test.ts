import { describe, expect, it } from 'vitest';

import { discoveryAgent } from './built-in.js';

describe('Discovery system prompt snapshot', () => {
  it('matches the built-in prompt', () => {
    expect(discoveryAgent.systemPrompt).toMatchSnapshot();
  });
});
