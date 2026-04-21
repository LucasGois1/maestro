import type { ArchitectModelOutput } from './architect-output.schema.js';

export const FITS_LAYERS: {
  readonly input: Record<string, unknown>;
  readonly output: ArchitectModelOutput;
} = {
  input: {
    sprintIdx: 1,
    sprintName: 'API base',
  },
  output: {
    sprintIdx: 1,
    scopeTecnico: {
      newFiles: [{ path: 'packages/api/src/routes/health.ts', layer: 'transport' }],
      filesToTouch: ['packages/api/src/app.ts'],
      testFiles: ['packages/api/test/health.test.ts'],
    },
    patternsToFollow: ['Mantém handlers finos; lógica em serviços.'],
    libraries: [{ name: 'hono', reason: 'Já é dependência do pacote api.' }],
    boundaryCheck: 'ok',
  },
};

export const VIOLATION_REFACTOR: {
  readonly input: Record<string, unknown>;
  readonly output: ArchitectModelOutput;
} = {
  input: { sprintIdx: 2, sprintName: 'DB direto no handler' },
  output: {
    sprintIdx: 2,
    scopeTecnico: {
      newFiles: [],
      filesToTouch: ['packages/api/src/routes/users.ts'],
      testFiles: [],
    },
    patternsToFollow: ['Acesso a dados só via repositório.'],
    libraries: [],
    boundaryCheck: 'refactor_needed',
    boundaryNotes:
      'O sprint propõe SQL no handler; é necessário extrair repositório antes ou adicionar sprint prévio de infra.',
  },
};

export const NEW_LIB: {
  readonly input: Record<string, unknown>;
  readonly output: ArchitectModelOutput;
} = {
  input: { sprintIdx: 1, sprintName: 'Parsing avançado' },
  output: {
    sprintIdx: 1,
    scopeTecnico: {
      newFiles: [{ path: 'packages/lib/src/parse.ts', layer: 'domain' }],
      filesToTouch: [],
      testFiles: ['packages/lib/test/parse.test.ts'],
    },
    patternsToFollow: ['Testes colocados junto do pacote.'],
    libraries: [
      {
        name: 'chevrotain',
        reason: 'Parser CFG; não existe alternativa interna; MIT compatível.',
      },
    ],
    boundaryCheck: 'ok',
  },
};

export const LOW_LAYER_FIRST: {
  readonly input: Record<string, unknown>;
  readonly output: ArchitectModelOutput;
} = {
  input: { sprintIdx: 3, sprintName: 'UI sem contrato de API' },
  output: {
    sprintIdx: 3,
    scopeTecnico: {
      newFiles: [{ path: 'apps/web/src/pages/Dash.tsx', layer: 'ui' }],
      filesToTouch: [],
      testFiles: [],
    },
    patternsToFollow: ['Contratos OpenAPI antes de consumo no cliente.'],
    libraries: [],
    boundaryCheck: 'refactor_needed',
    boundaryNotes:
      'Depende de endpoints ainda não existentes; propor sprint anterior para OpenAPI + stubs.',
  },
};
