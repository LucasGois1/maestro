import type { EvaluatorInput } from './evaluator-input.schema.js';
import type { EvaluatorModelOutput } from './evaluator-output.schema.js';

const baseInput: EvaluatorInput = {
  runId: 'run-fixture',
  sprintIdx: 1,
  repoRoot: '/tmp/repo',
  worktreeRoot: '/tmp/repo',
  iteration: 1,
  sprintContract: '---\nsprint: 1\n---\n\n# Sprint\n',
  generatorOutput: { selfEval: { coversAllCriteria: true } },
  codeDiff: 'diff --git a/x.ts b/x.ts\n',
  sprint: { name: 'API', objective: 'Add endpoint' },
  acceptance: ['Returns 201 on success'],
};

/** Sprint claramente dentro do contrato; sensores OK. */
export const FIXTURE_PASSED: {
  readonly input: EvaluatorInput;
  readonly output: EvaluatorModelOutput;
} = {
  input: baseInput,
  output: {
    decision: 'passed',
    structuredFeedback:
      '## Summary\nAll acceptance criteria verified against diff and selfEval.\n\n## Evidence\n- Diff adds handler\n- Sensor `unit` passed',
    coverage: 0.95,
    sensorsRun: [{ id: 'unit', ok: true, detail: 'exit 0' }],
    artifacts: ['src/api.ts'],
    suggestedActions: [],
  },
};

/** Falha com linha específica citável no feedback (critério de mensagem). */
export const FIXTURE_FAILED_MESSAGE: {
  readonly input: EvaluatorInput;
  readonly output: EvaluatorModelOutput;
} = {
  input: {
    ...baseInput,
    iteration: 2,
    codeDiff: 'error message still generic',
  },
  output: {
    decision: 'failed',
    structuredFeedback:
      '## Summary\nAcceptance criterion **user-facing error message** not met.\n\n## Detail\nLine 42 in `errors.ts` still uses `Error: failed` instead of a clear message.',
    sensorsRun: [],
    artifacts: ['errors.ts:42'],
    suggestedActions: [
      'Replace generic throw with ValidationError and map code ERR_CHECKOUT to user copy.',
    ],
  },
};

/** Escalação — necessita decisão humana / ambiente ausente. */
export const FIXTURE_ESCALATED: {
  readonly input: EvaluatorInput;
  readonly output: EvaluatorModelOutput;
} = {
  input: {
    ...baseInput,
    sprintContract: 'sensors_required: [staging-e2e]',
    acceptance: ['Passes staging E2E'],
  },
  output: {
    decision: 'escalated',
    structuredFeedback:
      '## Summary\nStaging credentials and VPN are not available in this evaluation environment.\n\n## Blocker\nCannot run `staging-e2e` sensor.',
    sensorsRun: [{ id: 'staging-e2e', ok: false, detail: 'skipped' }],
    artifacts: [],
    suggestedActions: [
      'Run staging-e2e manually or provide credentials in CI for the evaluator.',
    ],
  },
};

/** Sensor obrigatório do contrato falhou. */
export const FIXTURE_SENSOR_FAILED: {
  readonly input: EvaluatorInput;
  readonly output: EvaluatorModelOutput;
} = {
  input: {
    ...baseInput,
    sprintContract: 'sensors_required: ["lint"]',
  },
  output: {
    decision: 'failed',
    structuredFeedback:
      '## Summary\nContract requires lint sensor; lint reported violations.\n\n## Violations\n- unused import in `foo.ts`',
    sensorsRun: [{ id: 'lint', ok: false, detail: '2 errors' }],
    artifacts: ['foo.ts'],
    suggestedActions: ['Fix lint errors and re-run.'],
  },
};

/** Verificação via API (callApi) mencionada no output. */
export const FIXTURE_API_CHECK: {
  readonly input: EvaluatorInput;
  readonly output: EvaluatorModelOutput;
} = {
  input: {
    ...baseInput,
    acceptance: ['Health endpoint returns 200'],
  },
  output: {
    decision: 'passed',
    structuredFeedback:
      '## Summary\n`callApi` to `/health` returned 200 with `{\\"ok\\":true}`.\n\n## Evidence\nMatches acceptance criterion.',
    sensorsRun: [],
    artifacts: ['GET /health'],
    suggestedActions: [],
  },
};
