import type { PlannerModelOutput } from './plan-output.schema.js';

/** Narrow, user-visible scope → single sprint (proportional sizing). */
export const NARROW_DELIVERY: {
  readonly input: { readonly prompt: string };
  readonly output: PlannerModelOutput;
} = {
  input: {
    prompt:
      'Replace Portuguese UI copy with English in the TUI help/footer and error strings; limit to packages/tui and related CLI copy.',
  },
  output: {
    escalationReason: null,
    feature: 'EN copy for TUI',
    overview:
      'Users see consistent English strings in the terminal UI and related CLI messages.\nOne cohesive change set for the scoped surfaces.',
    userStories: [
      {
        id: 1,
        role: 'developer',
        action: 'ship English UI strings in scope',
        value: 'Portuguese literals removed from named packages',
      },
    ],
    aiFeatures: [],
    sprints: [
      {
        idx: 1,
        name: 'Translate scoped copy',
        objective:
          'Update user-visible literals to English in the named packages; adjust tests if assertions pin old copy.',
        userStoryIds: [1],
        dependsOn: [],
        complexity: 'low',
        keyFeatures: ['TUI copy', 'CLI helper strings'],
      },
    ],
  },
};

/** Product-sized prompt → multi-sprint plan with real dependency between sprints. */
export const SIMPLE: {
  readonly input: { readonly prompt: string };
  readonly output: PlannerModelOutput;
} = {
  input: { prompt: 'Ship authentication for our SaaS' },
  output: {
    escalationReason: null,
    feature: 'Auth SaaS',
    overview:
      'Users sign in securely; admins manage sessions.\nSecond paragraph for vision.',
    userStories: [
      {
        id: 1,
        role: 'utilizador',
        action: 'iniciar sessão com email',
        value: 'aceder à conta',
      },
      {
        id: 2,
        role: 'admin',
        action: 'revogar sessões',
        value: 'segurança da equipa',
      },
    ],
    aiFeatures: ['Deteção de login suspeito'],
    sprints: [
      {
        idx: 1,
        name: 'Sessões e cookies',
        objective: 'Estabelecer sessão segura e renovação.',
        userStoryIds: [1],
        dependsOn: [],
        complexity: 'medium',
        keyFeatures: ['Cookie httpOnly', 'CSRF'],
      },
      {
        idx: 2,
        name: 'Gestão admin',
        objective: 'Revogar sessões e auditoria.',
        userStoryIds: [2],
        dependsOn: [1],
        complexity: 'high',
        keyFeatures: ['Lista de sessões', 'Revogação'],
      },
    ],
  },
};

/** Escopo implícito (produto sem nome explícito). */
export const IMPLICIT_SCOPE: {
  readonly input: { readonly prompt: string };
  readonly output: PlannerModelOutput;
} = {
  input: {
    prompt: 'Quero que as pessoas partilhem ficheiros grandes sem email',
  },
  output: {
    escalationReason: null,
    feature: 'Partilha de ficheiros',
    overview: 'Partilha simples de links com expiração.\nFoco em UX mínima.',
    userStories: [
      {
        id: 1,
        role: 'remetente',
        action: 'gerar link de upload',
        value: 'enviar sem anexos',
      },
      {
        id: 2,
        role: 'destinatário',
        action: 'descarregar com um clique',
        value: 'receber ficheiros rapidamente',
      },
    ],
    aiFeatures: [],
    sprints: [
      {
        idx: 1,
        name: 'Upload e link',
        objective: 'Fluxo de upload e geração de URL.',
        userStoryIds: [1],
        dependsOn: [],
        complexity: 'low',
        keyFeatures: ['Drag-drop', 'Link único'],
      },
      {
        idx: 2,
        name: 'Download e expiração',
        objective: 'Download seguro e TTL.',
        userStoryIds: [2],
        dependsOn: [1],
        complexity: 'medium',
        keyFeatures: ['Expiração configurável'],
      },
    ],
  },
};

/** Pedido vago — pedir clarificação via escalation (não inventar produto). */
export const VAGUE: {
  readonly input: { readonly prompt: string };
  readonly output: PlannerModelOutput;
} = {
  input: { prompt: 'Melhora isto' },
  output: {
    escalationReason:
      'O pedido não identifica produto, utilizadores nem resultado mensurável; é necessário contexto antes de planear sprints.',
    feature: null,
    overview: null,
    userStories: null,
    aiFeatures: null,
    sprints: null,
  },
};

/** Pedido contraditório — escalar. */
export const CONTRADICTION: {
  readonly input: { readonly prompt: string };
  readonly output: PlannerModelOutput;
} = {
  input: {
    prompt:
      'Quero um produto sem login mas cada utilizador só vê os seus dados privados.',
  },
  output: {
    escalationReason:
      'Sem identidade de utilizador não é possível garantir dados privados por pessoa; requisitos incompatíveis.',
    feature: null,
    overview: null,
    userStories: null,
    aiFeatures: null,
    sprints: null,
  },
};
