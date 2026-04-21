import { render } from 'ink-testing-library';
import { describe, expect, it } from 'vitest';

import { createInitialTuiState } from '../state/store.js';

import { PipelinePanel } from './PipelinePanel.js';

describe('PipelinePanel', () => {
  it('renders seven stages in order with pending markers by default', () => {
    const state = createInitialTuiState();
    const app = render(
      <PipelinePanel pipeline={state.pipeline} sprints={state.sprints} />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('Discovering');
    expect(frame).toContain('Planning');
    expect(frame).toContain('Architecting');
    expect(frame).toContain('Contracting');
    expect(frame).toContain('Generating');
    expect(frame).toContain('Evaluating');
    expect(frame).toContain('Merging');
    expect(frame).toContain('status: idle');
    app.unmount();
  });

  it('renders running, passed and pending icons based on pipeline state', () => {
    const app = render(
      <PipelinePanel
        pipeline={{
          status: 'running',
          stage: 'generating',
          sprintIdx: 1,
          retryCount: 0,
          error: null,
          history: [
            { stage: 'discovering', startedAt: 0, endedAt: 100 },
            { stage: 'planning', startedAt: 100, endedAt: 2_000 },
            { stage: 'architecting', startedAt: 2_000, endedAt: 5_000 },
            { stage: 'contracting', startedAt: 5_000, endedAt: 6_000 },
            { stage: 'generating', startedAt: 6_000, endedAt: null },
          ],
        }}
        sprints={[{ idx: 1, status: 'running', retries: 0 }]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('✓ Discovering');
    expect(frame).toContain('✓ Planning');
    expect(frame).toContain('⟳ Generating');
    expect(frame).toContain('○ Evaluating');
    expect(frame).toContain('○ Merging');
    expect(frame).toContain('sprint #1');
    app.unmount();
  });

  it('renders failed stage with error message', () => {
    const app = render(
      <PipelinePanel
        pipeline={{
          status: 'failed',
          stage: 'evaluating',
          sprintIdx: 2,
          retryCount: 2,
          error: 'tests broken',
          history: [
            { stage: 'planning', startedAt: 0, endedAt: 1_000 },
            { stage: 'evaluating', startedAt: 1_000, endedAt: 1_500 },
          ],
        }}
        sprints={[{ idx: 2, status: 'failed', retries: 2 }]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('✗ Evaluating');
    expect(frame).toContain('error: tests broken');
    expect(frame).toContain('retries 2');
    app.unmount();
  });

  it('renders paused icon when pipeline is paused', () => {
    const app = render(
      <PipelinePanel
        pipeline={{
          status: 'paused',
          stage: 'generating',
          sprintIdx: 1,
          retryCount: 0,
          error: null,
          history: [{ stage: 'generating', startedAt: 0, endedAt: null }],
        }}
        sprints={[{ idx: 1, status: 'running', retries: 0 }]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('⏸ Generating');
    app.unmount();
  });

  it('renders escalated icon when a sprint is escalated', () => {
    const app = render(
      <PipelinePanel
        pipeline={{
          status: 'running',
          stage: 'generating',
          sprintIdx: 1,
          retryCount: 3,
          error: null,
          history: [{ stage: 'generating', startedAt: 0, endedAt: null }],
        }}
        sprints={[{ idx: 1, status: 'escalated', retries: 3 }]}
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).toContain('! Generating');
    app.unmount();
  });

  it('suppresses ANSI colors when colorMode is no-color', () => {
    const app = render(
      <PipelinePanel
        pipeline={{
          status: 'running',
          stage: 'generating',
          sprintIdx: 1,
          retryCount: 0,
          error: null,
          history: [{ stage: 'generating', startedAt: 0, endedAt: null }],
        }}
        sprints={[{ idx: 1, status: 'running', retries: 0 }]}
        colorMode="no-color"
      />,
    );

    const frame = app.lastFrame() ?? '';
    expect(frame).not.toContain('\u001B[');
    app.unmount();
  });
});
