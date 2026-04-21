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
    delayMs: 50,
    event: {
      type: 'pipeline.stage_entered',
      runId: RUN_ID,
      stage: 'planning',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'agent.started',
      runId: RUN_ID,
      agentId: 'planner',
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'agent.delta',
      runId: RUN_ID,
      agentId: 'planner',
      chunk: 'Planning sprints…',
    },
  },
  {
    delayMs: 100,
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
    delayMs: 100,
    event: {
      type: 'agent.started',
      runId: RUN_ID,
      agentId: 'generator',
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'agent.delta',
      runId: RUN_ID,
      agentId: 'generator',
      chunk: 'writing module A…',
    },
  },
  {
    delayMs: 50,
    event: {
      type: 'sensor.started',
      runId: RUN_ID,
      sensorId: 'ruff',
      kind: 'computational',
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'sensor.progress',
      runId: RUN_ID,
      sensorId: 'ruff',
      message: 'checking imports',
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'sensor.completed',
      runId: RUN_ID,
      sensorId: 'ruff',
      status: 'passed',
      durationMs: 200,
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
    delayMs: 100,
    event: {
      type: 'sensor.started',
      runId: RUN_ID,
      sensorId: 'mypy',
      kind: 'computational',
    },
  },
  {
    delayMs: 200,
    event: {
      type: 'sensor.failed',
      runId: RUN_ID,
      sensorId: 'mypy',
      error: 'type mismatch on foo',
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'pipeline.sprint_retried',
      runId: RUN_ID,
      sprintIdx: 2,
      retry: 1,
    },
  },
  {
    delayMs: 100,
    event: {
      type: 'agent.decision',
      runId: RUN_ID,
      agentId: 'evaluator',
      message: 'retry sprint 2 with refined plan',
    },
  },
  {
    delayMs: 200,
    event: {
      type: 'pipeline.sprint_started',
      runId: RUN_ID,
      sprintIdx: 3,
      totalSprints: 3,
    },
  },
  {
    delayMs: 150,
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
