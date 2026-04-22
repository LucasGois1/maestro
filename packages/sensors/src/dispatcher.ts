import type { EventBus } from '@maestro/core';
import {
  composePolicy,
  type ApprovalPrompter,
  type Policy,
} from '@maestro/sandbox';
import type { MaestroConfig } from '@maestro/config';

import type { InferentialAgentRegistry as AgentRegistry } from './inferential-agent-types.js';

import type { SensorDefinition } from './schema.js';
import { sensorAppliesToFiles } from './selection.js';
import { runSensor, type AgentRunner, type ShellRunner } from './runner.js';
import type { SensorResult } from './types.js';

export type DispatchSensorsOptions = {
  readonly runId: string;
  readonly repoRoot: string;
  readonly bus: EventBus;
  readonly changedFiles?: readonly string[];
  readonly diff?: string;
  readonly maestroDir?: string;
  readonly concurrency?: number;
  readonly policy?: Policy;
  readonly approver?: ApprovalPrompter;
  readonly shellRunner?: ShellRunner;
  readonly agentRunner?: AgentRunner;
  readonly registry?: AgentRegistry;
  readonly config?: MaestroConfig;
};

function sortByPriority(
  sensors: readonly SensorDefinition[],
): SensorDefinition[] {
  return [...sensors].sort((left, right) => {
    if (left.onFail === right.onFail) {
      return left.id.localeCompare(right.id);
    }
    return left.onFail === 'block' ? -1 : 1;
  });
}

export async function dispatchSensors(
  sensors: readonly SensorDefinition[],
  options: DispatchSensorsOptions,
): Promise<readonly SensorResult[]> {
  const changedFiles = options.changedFiles ?? [];
  const runnable = sortByPriority(
    sensors.filter((sensor) => sensorAppliesToFiles(sensor, changedFiles)),
  );
  const skipped = sensors
    .filter((sensor) => !sensorAppliesToFiles(sensor, changedFiles))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(
      (sensor): SensorResult => ({
        sensorId: sensor.id,
        status: 'skipped',
        durationMs: 0,
        stdout: '',
        stderr: '',
        violations: [],
      }),
    );

  const policy = options.policy ?? composePolicy({ mode: 'allowlist' });
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results = new Array<SensorResult>(runnable.length);
  let nextIndex = 0;
  const running = new Set<Promise<void>>();

  for (const sensor of runnable) {
    options.bus.emit({
      type: 'sensor.registered',
      runId: options.runId,
      sensorId: sensor.id,
      kind: sensor.kind,
      onFail: sensor.onFail,
    });
  }

  const launch = (sensor: SensorDefinition, index: number) => {
    const task = runSensor(sensor, {
      runId: options.runId,
      repoRoot: options.repoRoot,
      bus: options.bus,
      ...(options.maestroDir !== undefined
        ? { maestroDir: options.maestroDir }
        : {}),
      ...(options.diff !== undefined ? { diff: options.diff } : {}),
      policy,
      ...(options.approver !== undefined ? { approver: options.approver } : {}),
      ...(options.shellRunner !== undefined
        ? { shellRunner: options.shellRunner }
        : {}),
      ...(options.agentRunner !== undefined
        ? { agentRunner: options.agentRunner }
        : {}),
      ...(options.registry !== undefined ? { registry: options.registry } : {}),
      ...(options.config !== undefined ? { config: options.config } : {}),
    })
      .then((result) => {
        results[index] = result;
      })
      .finally(() => {
        running.delete(task);
      });
    running.add(task);
  };

  while (nextIndex < runnable.length || running.size > 0) {
    while (nextIndex < runnable.length && running.size < concurrency) {
      const sensor = runnable[nextIndex];
      if (sensor) {
        launch(sensor, nextIndex);
      }
      nextIndex += 1;
    }
    if (running.size > 0) {
      await Promise.race(running);
    }
  }

  return [...results, ...skipped];
}
