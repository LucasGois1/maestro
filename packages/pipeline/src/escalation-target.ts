import type {
  EscalationSource,
  PipelineFailureAt,
  ResumeTarget,
} from '@maestro/state';

/**
 * Deriva o alvo de resume por defeito (política conservadora do plano).
 * O humano ou CLI pode sobrescrever com `resumeTargetOverride`.
 */
export function defaultResumeTargetForEscalation(args: {
  readonly source: EscalationSource;
  readonly phaseAtEscalation: PipelineFailureAt;
  readonly reason: string;
  /** Quando o evaluator esgotou o orçamento de retries (último ramo). */
  readonly evaluatorRetryExhausted?: boolean;
}): ResumeTarget {
  if (args.source === 'architect') {
    return 'ReplanOnly';
  }
  if (args.source === 'planner') {
    return 'ReplanOnly';
  }
  if (args.source === 'pipeline' && args.evaluatorRetryExhausted) {
    return 'ContinueGenerate';
  }
  if (args.source === 'evaluator') {
    if (args.evaluatorRetryExhausted) {
      return 'ContinueGenerate';
    }
    return evaluatorEscalationResumeTarget(args.reason);
  }
  return 'ContinueGenerate';
}

function evaluatorEscalationResumeTarget(reason: string): ResumeTarget {
  const r = reason.toLowerCase();
  if (
    /\bcontract\b/u.test(r) ||
    /\bcontrato\b/u.test(r) ||
    /\bscope\b/u.test(r) ||
    /\bâmbito\b/u.test(r)
  ) {
    return 'ReSeedContract';
  }
  return 'ReArchitectAndContract';
}
