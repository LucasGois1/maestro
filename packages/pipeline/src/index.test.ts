import { describe, expect, it } from 'vitest';

import {
  defaultAgentExecutor,
  PIPELINE_PACKAGE_NAME,
  resumePipeline,
  runPipeline,
} from './index.js';

describe('@maestro/pipeline exports', () => {
  it('exposes the public pipeline API', () => {
    expect(PIPELINE_PACKAGE_NAME).toBe('@maestro/pipeline');
    expect(typeof runPipeline).toBe('function');
    expect(typeof resumePipeline).toBe('function');
    expect(typeof defaultAgentExecutor).toBe('function');
  });
});
