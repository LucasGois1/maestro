import type { PipelineStageName } from '@maestro/core';

/**
 * Short PT hint when an agent is active but the log is still empty (no stream yet).
 */
export function activeAgentWorkingHint(
  agentId: string,
  stage: PipelineStageName | null,
): string {
  const pair = `${agentId}:${stage ?? ''}`;
  switch (pair) {
    case 'planner:planning':
      return 'A gerar o plano do produto…';
    case 'architect:architecting':
      return 'Arquitetura em curso…';
    case 'generator:generating':
      return 'Geração em curso…';
    case 'evaluator:evaluating':
      return 'Avaliação em curso…';
    case 'merger:merging':
      return 'Integração em curso…';
    default:
      break;
  }
  if (stage !== null) {
    switch (stage) {
      case 'discovering':
        return 'Descoberta em curso…';
      case 'contracting':
        return 'Contrato do sprint em preparação…';
      default:
        break;
    }
  }
  return 'Agente a trabalhar…';
}
