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
  switch (agentId) {
    case 'planner':
      return 'Planeamento em curso…';
    case 'architect':
      return 'Arquitetura em curso…';
    case 'generator':
      return 'Geração em curso…';
    case 'evaluator':
      return 'Avaliação em curso…';
    case 'merger':
      return 'Integração em curso…';
    case 'code-reviewer':
      return 'Revisão de código em curso…';
    case 'doc-gardener':
      return 'Manutenção de documentação em curso…';
    case 'discovery':
      return 'Descoberta do repositório em curso…';
    default:
      return 'Agente a trabalhar…';
  }
}
