import { resolve } from 'node:path';

import {
  codeReviewerAgent,
  runAgent,
  type AgentRegistry,
  type RunAgentResult,
} from '@maestro/agents';
import type { MaestroConfig } from '@maestro/config';
import type { EventBus } from '@maestro/core';
import {
  composePolicy,
  runShellCommand,
  type ApprovalPrompter,
  type Policy,
  type RunCommandOptions,
  type RunCommandResult,
} from '@maestro/sandbox';

import {
  type ComputationalSensorDefinition,
  type InferentialSensorDefinition,
  type SensorDefinition,
} from './schema.js';
import { parseSensorOutput } from './parsers.js';
import type { SensorResult, Violation } from './types.js';

export type ShellRunner = (
  options: RunCommandOptions,
) => Promise<RunCommandResult>;

export type AgentRunner = typeof runAgent;

export type SensorRunContext = {
  readonly runId: string;
  readonly repoRoot: string;
  readonly bus: EventBus;
  readonly maestroDir?: string;
  readonly diff?: string;
  readonly policy?: Policy;
  readonly approver?: ApprovalPrompter;
  readonly shellRunner?: ShellRunner;
  readonly agentRunner?: AgentRunner;
  readonly registry?: AgentRegistry;
  readonly config?: MaestroConfig;
};

function emitCompleted(
  bus: EventBus,
  runId: string,
  sensorId: string,
  status: SensorResult['status'],
  durationMs: number,
): void {
  bus.emit({
    type: 'sensor.completed',
    runId,
    sensorId,
    status,
    durationMs,
  });
}

function mapFailureStatus(
  onFail: SensorDefinition['onFail'],
): 'failed' | 'warned' {
  return onFail === 'warn' ? 'warned' : 'failed';
}

function isTimedOutError(
  error: unknown,
): error is {
  readonly message: string;
  readonly timeoutMs: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  return (
    typeof error === 'object' &&
    error !== null &&
    'timeoutMs' in error &&
    typeof (error as { timeoutMs: unknown }).timeoutMs === 'number'
  );
}

function resolveCommand(
  sensor: ComputationalSensorDefinition,
): { cmd: string; args: string[] } {
  if (sensor.args.length > 0) {
    return {
      cmd: sensor.command,
      args: [...sensor.args],
    };
  }

  const [cmd, ...args] = splitCommandString(sensor.command);
  if (!cmd) {
    throw new Error(`Sensor "${sensor.id}" has an empty command.`);
  }
  return { cmd, args };
}

function splitCommandString(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if (char === undefined) {
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && i + 1 < command.length) {
        current += command[i + 1];
        i += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/u.test(char)) {
      if (current.length > 0) {
        parts.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

function resolveCwd(sensor: ComputationalSensorDefinition, repoRoot: string): string {
  if (!sensor.cwd) {
    return repoRoot;
  }
  return resolve(repoRoot, sensor.cwd);
}

function resolveInferentialOutput(
  output: Awaited<RunAgentResult<unknown>>['output'],
): { status: 'passed' | 'failed'; violations: readonly Violation[] } {
  if (
    output &&
    typeof output === 'object' &&
    'verdict' in output &&
    'findings' in output &&
    Array.isArray((output as { findings: unknown[] }).findings)
  ) {
    const reviewer = output as {
      verdict: 'approve' | 'request-changes' | 'comment';
      findings: Array<{
        path: string;
        line?: number;
        message: string;
        severity: 'info' | 'warn' | 'error';
      }>;
    };

    const violations = reviewer.findings.map((finding) => ({
      rule: 'code-review',
      message: finding.message,
      severity: finding.severity,
      path: finding.path,
      ...(finding.line !== undefined ? { line: finding.line } : {}),
      source: 'code-reviewer',
    }));

    const status =
      reviewer.verdict === 'approve' && violations.length === 0
        ? 'passed'
        : 'failed';

    return { status, violations };
  }

  return { status: 'passed', violations: [] };
}

async function runComputationalSensor(
  sensor: ComputationalSensorDefinition,
  context: SensorRunContext,
): Promise<SensorResult> {
  const shellRunner = context.shellRunner ?? runShellCommand;
  const policy = context.policy ?? composePolicy({ mode: 'allowlist' });
  const { cmd, args } = resolveCommand(sensor);

  context.bus.emit({
    type: 'sensor.started',
    runId: context.runId,
    sensorId: sensor.id,
    kind: sensor.kind,
    onFail: sensor.onFail,
  });
  context.bus.emit({
    type: 'sensor.progress',
    runId: context.runId,
    sensorId: sensor.id,
    message: 'running command',
  });

  try {
    const execution = await shellRunner({
      cmd,
      args,
      cwd: resolveCwd(sensor, context.repoRoot),
      runId: context.runId,
      repoRoot: context.repoRoot,
      ...(context.maestroDir !== undefined
        ? { maestroDir: context.maestroDir }
        : {}),
      policy,
      ...(context.approver !== undefined ? { approver: context.approver } : {}),
      timeoutMs: sensor.timeoutSec * 1000,
    });

    context.bus.emit({
      type: 'sensor.progress',
      runId: context.runId,
      sensorId: sensor.id,
      message: 'parsing output',
    });

    const parsed = parseSensorOutput({
      parser: sensor.parseOutput,
      exitCode: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr,
    });
    const status =
      execution.exitCode === sensor.expectExitCode
        ? 'passed'
        : mapFailureStatus(sensor.onFail);

    const result: SensorResult = {
      sensorId: sensor.id,
      status,
      durationMs: execution.durationMs,
      stdout: execution.stdout,
      stderr: execution.stderr,
      parsed: parsed.parsed,
      violations: parsed.violations,
    };
    emitCompleted(
      context.bus,
      context.runId,
      sensor.id,
      result.status,
      result.durationMs,
    );
    return result;
  } catch (error) {
    if (isTimedOutError(error)) {
      context.bus.emit({
        type: 'sensor.failed',
        runId: context.runId,
        sensorId: sensor.id,
        error: error.message,
      });
      const result: SensorResult = {
        sensorId: sensor.id,
        status: 'timeout',
        durationMs: error.timeoutMs,
        stdout: error.stdout,
        stderr: error.stderr,
        violations: [],
      };
      emitCompleted(
        context.bus,
        context.runId,
        sensor.id,
        result.status,
        result.durationMs,
      );
      return result;
    }

    const message = error instanceof Error ? error.message : String(error);
    context.bus.emit({
      type: 'sensor.failed',
      runId: context.runId,
      sensorId: sensor.id,
      error: message,
    });
    const result: SensorResult = {
      sensorId: sensor.id,
      status: 'error',
      durationMs: 0,
      stdout: '',
      stderr: message,
      violations: [],
    };
    emitCompleted(
      context.bus,
      context.runId,
      sensor.id,
      result.status,
      result.durationMs,
    );
    return result;
  }
}

function resolveAgentDefinition(
  sensor: InferentialSensorDefinition,
  registry?: AgentRegistry,
) {
  const fromRegistry = registry?.get(sensor.agent);
  if (fromRegistry) {
    return fromRegistry;
  }
  if (sensor.agent === codeReviewerAgent.id) {
    return codeReviewerAgent;
  }
  throw new Error(`Unknown inferential sensor agent "${sensor.agent}".`);
}

async function runInferentialSensor(
  sensor: InferentialSensorDefinition,
  context: SensorRunContext,
): Promise<SensorResult> {
  const agentRunner = context.agentRunner ?? runAgent;
  const definition = resolveAgentDefinition(sensor, context.registry);

  context.bus.emit({
    type: 'sensor.started',
    runId: context.runId,
    sensorId: sensor.id,
    kind: sensor.kind,
    onFail: sensor.onFail,
  });
  context.bus.emit({
    type: 'sensor.progress',
    runId: context.runId,
    sensorId: sensor.id,
    message: `running ${sensor.agent}`,
  });

  try {
    const execution = await agentRunner({
      definition,
      input: { diff: context.diff ?? '' },
      context: {
        agentId: sensor.agent,
        runId: context.runId,
        workingDir: context.repoRoot,
        metadata: {
          sensorId: sensor.id,
          criteria: sensor.criteria,
        },
      },
      bus: context.bus,
      ...(context.config !== undefined ? { config: context.config } : {}),
    });

    const normalized = resolveInferentialOutput(execution.output);
    const status =
      normalized.status === 'passed'
        ? 'passed'
        : mapFailureStatus(sensor.onFail);

    const result: SensorResult = {
      sensorId: sensor.id,
      status,
      durationMs: execution.durationMs,
      stdout: execution.text,
      stderr: '',
      parsed: execution.output,
      violations: normalized.violations,
    };
    emitCompleted(
      context.bus,
      context.runId,
      sensor.id,
      result.status,
      result.durationMs,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.bus.emit({
      type: 'sensor.failed',
      runId: context.runId,
      sensorId: sensor.id,
      error: message,
    });
    const result: SensorResult = {
      sensorId: sensor.id,
      status: 'error',
      durationMs: 0,
      stdout: '',
      stderr: message,
      violations: [],
    };
    emitCompleted(
      context.bus,
      context.runId,
      sensor.id,
      result.status,
      result.durationMs,
    );
    return result;
  }
}

export async function runSensor(
  sensor: SensorDefinition,
  context: SensorRunContext,
): Promise<SensorResult> {
  return sensor.kind === 'computational'
    ? runComputationalSensor(sensor, context)
    : runInferentialSensor(sensor, context);
}
