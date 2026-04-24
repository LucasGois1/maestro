import type { EventBus, MaestroEvent } from '@maestro/core';
import { appendRunLog, type AppendRunLogOptions } from '@maestro/state';

const MAX_JSON = 500;
const MAX_ERR = 800;
const MAX_TOOL_RESULT = 900;
const MAX_FEEDBACK_HEAD = 220;

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function jsonPreview(value: unknown, max = MAX_JSON): string {
  try {
    const str = JSON.stringify(value);
    return truncate(str, max);
  } catch {
    return '(unserializable)';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** One-line rationale from evaluator structured output (first non-empty line). */
function firstFeedbackLine(structuredFeedback: unknown): string {
  if (typeof structuredFeedback !== 'string') {
    return '';
  }
  const line = structuredFeedback
    .split(/\r?\n/u)
    .find((l) => l.trim().length > 0);
  return truncate((line ?? '').trim(), MAX_FEEDBACK_HEAD);
}

/**
 * Human-oriented summary of structured agent output for run.log.md
 * (inputs are not duplicated here — see agent.tool_call / tool_result).
 */
function formatAgentCompletedDetail(agentId: string, output: unknown): string {
  if (!isRecord(output)) {
    return `output=${jsonPreview(output, 280)}`;
  }
  switch (agentId) {
    case 'evaluator': {
      const decision =
        typeof output.decision === 'string' ? output.decision : '?';
      const sensorsRun = Array.isArray(output.sensorsRun)
        ? output.sensorsRun
        : [];
      const ids = sensorsRun
        .map((row) =>
          isRecord(row) && typeof row.id === 'string' ? row.id : '?',
        )
        .join(', ');
      const okCount = sensorsRun.filter(
        (row) => isRecord(row) && row.ok === true,
      ).length;
      const actions = Array.isArray(output.suggestedActions)
        ? output.suggestedActions.length
        : 0;
      const head = firstFeedbackLine(output.structuredFeedback);
      return [
        `decision=${decision}`,
        `sensorsRun=${sensorsRun.length.toString()} (ok ${okCount.toString()})`,
        ids.length > 0 ? `sensorIds=${truncate(ids, 160)}` : 'sensorIds=(none)',
        `suggestedActions=${actions.toString()}`,
        head.length > 0 ? `feedbackHead=${head}` : 'feedbackHead=(empty)',
      ].join(' · ');
    }
    case 'generator': {
      const files = Array.isArray(output.filesChanged)
        ? output.filesChanged.length
        : 0;
      const commits = Array.isArray(output.commits) ? output.commits.length : 0;
      const self = isRecord(output.selfEval) ? output.selfEval : null;
      const covers =
        self !== null && typeof self.coversAllCriteria === 'boolean'
          ? self.coversAllCriteria
          : '?';
      const missing =
        self !== null && Array.isArray(self.missingCriteria)
          ? self.missingCriteria.length
          : 0;
      return `filesChanged=${files.toString()} commits=${commits.toString()} selfEval.coversAllCriteria=${String(covers)} missingCriteria=${missing.toString()}`;
    }
    case 'merger': {
      const runStatus =
        typeof output.runStatus === 'string' ? output.runStatus : '?';
      const commits =
        typeof output.commitCount === 'number' ? output.commitCount : '?';
      const prUrl = output.prUrl;
      const prN = output.prNumber;
      const pr =
        prUrl === null && prN === null
          ? 'pr=(none)'
          : `prUrl=${typeof prUrl === 'string' ? 'set' : '?'} prNumber=${typeof prN === 'number' ? prN.toString() : '?'}`;
      return `runStatus=${runStatus} commitCount=${String(commits)} ${pr}`;
    }
    case 'architect': {
      const bc =
        typeof output.boundaryCheck === 'string' ? output.boundaryCheck : '?';
      const idx =
        typeof output.sprintIdx === 'number'
          ? output.sprintIdx.toString()
          : '?';
      return `sprintIdx=${idx} boundaryCheck=${bc}`;
    }
    case 'planner': {
      const sprints = Array.isArray(output.sprints) ? output.sprints.length : 0;
      const feat = typeof output.feature === 'string' ? output.feature : '';
      return `sprints=${sprints.toString()}${feat.length > 0 ? ` feature=${truncate(feat, 80)}` : ''}`;
    }
    default:
      return truncate(jsonPreview(output, 400), 400);
  }
}

function formatToolResultLine(
  tool: string,
  result: unknown,
): { readonly ok: boolean; readonly detail: string } {
  if (result instanceof Error) {
    return { ok: false, detail: truncate(result.message, MAX_TOOL_RESULT) };
  }
  if (isRecord(result) && 'ok' in result && result.ok === false) {
    return {
      ok: false,
      detail: truncate(
        typeof result.error === 'string'
          ? result.error
          : jsonPreview(result, MAX_TOOL_RESULT),
        MAX_TOOL_RESULT,
      ),
    };
  }
  return { ok: true, detail: jsonPreview(result, MAX_TOOL_RESULT) };
}

type LogBase = Omit<AppendRunLogOptions, 'entry'>;

async function appendEntry(
  logBase: LogBase,
  entry: AppendRunLogOptions['entry'],
): Promise<void> {
  await appendRunLog({ ...logBase, entry });
}

/**
 * Subscreve o EventBus e persiste marcos úteis em `run.log.md` (por run).
 * Não duplica `pipeline.started` / `pipeline.resumed` / `sprint_escalated` /
 * `pipeline.completed` — esses continuam a ser escritos em `engine.ts`.
 *
 * As escritas são **serializadas** para a ordem das linhas no ficheiro coincidir
 * com a ordem dos `emit` (evita `agent.completed` aparecer depois da fase seguinte).
 */
export function attachRunLogToEventBus(options: {
  readonly bus: EventBus;
  readonly repoRoot: string;
  readonly runId: string;
  readonly maestroDir?: string;
}): () => void {
  const logBase: LogBase = {
    repoRoot: options.repoRoot,
    runId: options.runId,
    ...(options.maestroDir !== undefined
      ? { maestroDir: options.maestroDir }
      : {}),
  };

  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): void => {
    queue = queue.then(task).catch(() => undefined);
  };

  return options.bus.on((event: MaestroEvent) => {
    if (!('runId' in event) || event.runId !== options.runId) {
      return;
    }

    enqueue(async () => {
      switch (event.type) {
        case 'pipeline.stage_entered': {
          const sprint =
            event.sprintIdx !== undefined
              ? ` sprintIdx=${event.sprintIdx.toString()}`
              : '';
          await appendEntry(logBase, {
            event: 'pipeline.stage_entered',
            detail: `${event.stage}${sprint}`,
          });
          return;
        }
        case 'pipeline.sprint_started':
          await appendEntry(logBase, {
            event: 'pipeline.sprint_started',
            detail: `sprint ${event.sprintIdx.toString()}/${event.totalSprints.toString()}`,
          });
          return;
        case 'pipeline.sprint_retried':
          await appendEntry(logBase, {
            event: 'pipeline.sprint_retried',
            detail: `sprint ${event.sprintIdx.toString()} retry=${event.retry.toString()}`,
          });
          return;
        case 'pipeline.plan_revised':
          await appendEntry(logBase, {
            event: 'pipeline.plan_revised',
            detail: `attempt ${event.attempt.toString()} — ${truncate(event.reasonSummary, 400)}`,
          });
          return;
        case 'pipeline.paused':
          await appendEntry(logBase, {
            event: 'pipeline.paused',
            detail: `at ${event.at}`,
          });
          return;
        case 'pipeline.failed':
          await appendEntry(logBase, {
            event: 'pipeline.failed',
            level: 'error',
            detail: `at ${event.at} — ${truncate(event.error, MAX_ERR)}`,
          });
          return;
        case 'agent.started':
          await appendEntry(logBase, {
            event: 'agent.started',
            detail: event.agentId,
          });
          return;
        case 'agent.completed':
          await appendEntry(logBase, {
            event: 'agent.completed',
            detail: `${event.agentId} ${event.durationMs.toString()}ms — ${formatAgentCompletedDetail(event.agentId, event.output)}`,
          });
          return;
        case 'agent.failed':
          await appendEntry(logBase, {
            event: 'agent.failed',
            level: 'error',
            detail: `${event.agentId} — ${truncate(event.error, MAX_ERR)}`,
          });
          return;
        case 'agent.tool_call':
          await appendEntry(logBase, {
            event: 'agent.tool_call',
            detail: `${event.agentId} · ${event.tool} · ${jsonPreview(event.args)}`,
          });
          return;
        case 'agent.tool_result': {
          const { ok, detail } = formatToolResultLine(event.tool, event.result);
          await appendEntry(logBase, {
            event: 'agent.tool_result',
            detail: `${event.agentId} · ${event.tool} · ok=${ok.toString()} · ${detail}`,
          });
          return;
        }
        case 'agent.decision':
          await appendEntry(logBase, {
            event: 'agent.decision',
            detail: `${event.agentId} — ${truncate(event.message, MAX_ERR)}`,
          });
          return;
        case 'sensor.started':
          await appendEntry(logBase, {
            event: 'sensor.started',
            detail: `${event.sensorId} (${event.kind})`,
          });
          return;
        case 'sensor.completed':
          await appendEntry(logBase, {
            event: 'sensor.completed',
            detail: `${event.sensorId} → ${event.status} ${event.durationMs.toString()}ms`,
          });
          return;
        case 'sensor.failed':
          await appendEntry(logBase, {
            event: 'sensor.failed',
            level: 'error',
            detail: `${event.sensorId} — ${truncate(event.error, MAX_ERR)}`,
          });
          return;
        default:
          return;
      }
    });
  });
}
