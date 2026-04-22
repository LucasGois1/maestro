import { describe, expect, it } from 'vitest';

import {
  createStateStore,
  renderHandoffMarkdown,
  renderSelfEvalMarkdown,
  runRoot,
  STATE_PACKAGE_NAME,
  writeCompletedExecPlan,
} from './index.js';

describe('@maestro/state exports', () => {
  it('exposes the public helpers used by pipeline fixtures', () => {
    expect(STATE_PACKAGE_NAME).toBe('@maestro/state');
    expect(typeof createStateStore).toBe('function');
    expect(typeof renderHandoffMarkdown).toBe('function');
    expect(typeof renderSelfEvalMarkdown).toBe('function');
    expect(typeof runRoot).toBe('function');
    expect(typeof writeCompletedExecPlan).toBe('function');
  });
});
