import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import type { Policy } from '@maestro/sandbox';
import { maestroRoot } from '@maestro/state';
import { loadSensorsFile, runSensor } from '@maestro/sensors';

export type RunSensorToolContext = {
  readonly repoRoot: string;
  readonly runId: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
  readonly policy: Policy;
  readonly config: MaestroConfig;
  /** Diff unificado do sprint (inferencial code-reviewer). */
  readonly diff?: string;
  readonly sprintContract?: string;
  readonly goldenPrinciples?: readonly string[];
  readonly agentsMd?: string;
};

async function readUtf8Optional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function resolveKbContext(
  ctx: RunSensorToolContext,
): Promise<{
  readonly agentsMd: string;
  readonly goldenPrinciples: readonly string[];
}> {
  const root = maestroRoot(ctx.repoRoot, ctx.maestroDir);
  const agentsMd =
    ctx.agentsMd ?? (await readUtf8Optional(join(root, 'AGENTS.md'))) ?? '';
  const goldenFile = await readUtf8Optional(
    join(root, 'docs/golden-principles/index.md'),
  );
  const goldenPrinciples =
    ctx.goldenPrinciples ??
    (goldenFile && goldenFile.trim().length > 0 ? [goldenFile.trim()] : []);
  return { agentsMd, goldenPrinciples };
}

/**
 * Execução partilhada entre Generator e Evaluator (`runSensor` tool).
 */
export async function executeRunSensorTool(
  ctx: RunSensorToolContext,
  id: string,
  hook?: (sensorId: string) => Promise<string>,
): Promise<string> {
  if (hook) {
    return hook(id);
  }
  try {
    const file = await loadSensorsFile({
      repoRoot: ctx.repoRoot,
      ...(ctx.maestroDir !== undefined ? { maestroDir: ctx.maestroDir } : {}),
    });
    const sensor = file.sensors.find((s) => s.id === id);
    if (!sensor) {
      return `Sensor "${id}" não encontrado em sensors.json`;
    }
    const { agentsMd, goldenPrinciples } = await resolveKbContext(ctx);
    const result = await runSensor(sensor, {
      runId: ctx.runId,
      repoRoot: ctx.repoRoot,
      bus: ctx.bus,
      ...(ctx.maestroDir !== undefined ? { maestroDir: ctx.maestroDir } : {}),
      policy: ctx.policy,
      config: ctx.config,
      diff: ctx.diff ?? '',
      sprintContract: ctx.sprintContract ?? '',
      agentsMd,
      goldenPrinciples: [...goldenPrinciples],
    });
    return JSON.stringify(
      {
        sensorId: result.sensorId,
        status: result.status,
        durationMs: result.durationMs,
        stdout: result.stdout.slice(0, 8000),
        stderr: result.stderr.slice(0, 4000),
        violations: result.violations,
        parsed: result.parsed,
      },
      null,
      2,
    ).slice(0, 24_000);
  } catch (e) {
    return `Erro no sensor: ${e instanceof Error ? e.message : String(e)}`;
  }
}
