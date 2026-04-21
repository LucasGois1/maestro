import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';

import { PipelinePanel } from './PipelinePanel.js';

describe('PipelinePanel', () => {
  it('renders pipeline status, stage and sprint info', () => {
    const state = createInitialTuiState();
    const app = render(
      <PipelinePanel
        pipeline={{
          ...state.pipeline,
          status: 'running',
          stage: 'generating',
          sprintIdx: 2,
          retryCount: 1,
        }}
        sprints={[{ idx: 2, status: 'running', retries: 1 }]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('status: running');
    expect(frame).toContain('stage: generating');
    expect(frame).toContain('sprint 2');
    expect(frame).toContain('retries: 1');
    expect(frame).toContain('1 sprint(s) tracked');
    app.unmount();
  });

  it('handles idle state with no sprints', () => {
    const state = createInitialTuiState();
    const app = render(
      <PipelinePanel pipeline={state.pipeline} sprints={state.sprints} />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('status: idle');
    expect(frame).toContain('no sprint');
    app.unmount();
  });
});
