import type { EventBus, MaestroEvent } from '@maestro/core';

export interface DemoStep {
  readonly delayMs: number;
  readonly event: MaestroEvent;
}

export interface PlayDemoEventsOptions {
  readonly script?: readonly DemoStep[];
  readonly schedule?: (callback: () => void, ms: number) => unknown;
  readonly clear?: (handle: unknown) => void;
  readonly onFinish?: () => void;
}

const RUN_ID = 'demo-run';

export const DEMO_SCRIPT: readonly DemoStep[] = [
  { delayMs: 0, event: { type: 'pipeline.started', runId: RUN_ID } },
  {
    delayMs: 30,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'discovering',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'planning',
    },
  },
  {
    delayMs: 30,
    event: { type: 'agent.started', runId: RUN_ID, agentId: 'planner' },
  },
  {
    delayMs: 50,
    event: {
      type: 'agent.delta',
      runId: RUN_ID,
      agentId: 'planner',
      chunk: 'Breaking scope into sprints…',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'agent.decision',
      runId: RUN_ID,
      agentId: 'planner',
      message: 'Split auth work into 3 sprints',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'architecting',
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'agent.started',
      runId: RUN_ID,
      agentId: 'architect',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'agent.tool_call',
      runId: RUN_ID,
      agentId: 'architect',
      tool: 'read_repo_layout',
      args: {},
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'contracting',
    },
  },
  {
    delayMs: 60,
    event: {
      type: 'pipeline.sprint_started',
      runId: RUN_ID,
      sprintIdx: 1,
      totalSprints: 3,
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'generating',
      sprintIdx: 1,
    },
  },
  {
    delayMs: 40,
    event: { type: 'agent.started', runId: RUN_ID, agentId: 'generator' },
  },
  {
    delayMs: 60,
    event: {
      type: 'agent.delta',
      runId: RUN_ID,
      agentId: 'generator',
      chunk: 'Implementing auth/jwt.py…',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'agent.tool_call',
      runId: RUN_ID,
      agentId: 'generator',
      tool: 'write_file',
      args: { path: 'auth/jwt.py' },
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'sensor.started',
      runId: RUN_ID,
      sensorId: 'ruff',
      kind: 'computational',
    },
  },
  {
    delayMs: 60,
    event: {
      type: 'sensor.completed',
      runId: RUN_ID,
      sensorId: 'ruff',
      status: 'passed',
      durationMs: 200,
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'evaluating',
      sprintIdx: 1,
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.paused',
      runId: RUN_ID,
      at: 'evaluating',
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.resumed',
      runId: RUN_ID,
      from: 'evaluating',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.sprint_started',
      runId: RUN_ID,
      sprintIdx: 2,
      totalSprints: 3,
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'generating',
      sprintIdx: 2,
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'sensor.started',
      runId: RUN_ID,
      sensorId: 'mypy',
      kind: 'computational',
    },
  },
  {
    delayMs: 80,
    event: {
      type: 'sensor.failed',
      runId: RUN_ID,
      sensorId: 'mypy',
      error: 'type mismatch on foo',
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.sprint_retried',
      runId: RUN_ID,
      sprintIdx: 2,
      retry: 1,
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'agent.decision',
      runId: RUN_ID,
      agentId: 'evaluator',
      message: 'retry sprint 2 with refined plan',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'pipeline.sprint_escalated',
      runId: RUN_ID,
      sprintIdx: 2,
      reason: 'persistent type errors',
    },
  },
  {
    delayMs: 60,
    event: {
      type: 'pipeline.sprint_started',
      runId: RUN_ID,
      sprintIdx: 3,
      totalSprints: 3,
    },
  },
  {
    delayMs: 40,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'merging',
      sprintIdx: 3,
    },
  },
  {
    delayMs: 80,
    event: {
      type: 'pipeline.completed',
      runId: RUN_ID,
      durationMs: 1_200,
    },
  },
];

export interface DemoHandle {
  cancel(): void;
  readonly totalDurationMs: number;
}

export function playDemoEvents(
  bus: EventBus,
  options: PlayDemoEventsOptions = {},
): DemoHandle {
  const script = options.script ?? DEMO_SCRIPT;
  const schedule: (cb: () => void, ms: number) => unknown =
    options.schedule ?? ((cb, ms) => setTimeout(cb, ms));
  const clear: (handle: unknown) => void =
    options.clear ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const handles: unknown[] = [];
  let cumulativeDelay = 0;
  let cancelled = false;

  for (const [index, step] of script.entries()) {
    cumulativeDelay += step.delayMs;
    const isLast = index === script.length - 1;
    const handle = schedule(() => {
      if (cancelled) {
        return;
      }
      bus.emit(step.event);
      if (isLast) {
        options.onFinish?.();
      }
    }, cumulativeDelay);
    handles.push(handle);
  }

  return {
    cancel() {
      cancelled = true;
      for (const handle of handles) {
        clear(handle);
      }
    },
    totalDurationMs: cumulativeDelay,
  };
}
