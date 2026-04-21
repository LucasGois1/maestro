import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { EVALUATOR_SYSTEM_PROMPT } from './system-prompt.js';
import {
  FIXTURE_API_CHECK,
  FIXTURE_ESCALATED,
  FIXTURE_FAILED_MESSAGE,
  FIXTURE_PASSED,
  FIXTURE_SENSOR_FAILED,
} from './fixtures-data.js';

export const EVALUATOR_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: FIXTURE_PASSED.input,
    output: FIXTURE_PASSED.output,
    note: 'passed — critérios e sensores OK',
  },
  {
    input: FIXTURE_FAILED_MESSAGE.input,
    output: FIXTURE_FAILED_MESSAGE.output,
    note: 'failed — linha específica no feedback',
  },
  {
    input: FIXTURE_ESCALATED.input,
    output: FIXTURE_ESCALATED.output,
    note: 'escalated — ambiente / credenciais',
  },
  {
    input: FIXTURE_SENSOR_FAILED.input,
    output: FIXTURE_SENSOR_FAILED.output,
    note: 'failed — sensor do contrato',
  },
  {
    input: FIXTURE_API_CHECK.input,
    output: FIXTURE_API_CHECK.output,
    note: 'passed — evidência API',
  },
];

/** Mesmo texto efectivo que `runAgent` com `EVALUATOR_SYSTEM_PROMPT` + calibração. */
export function resolvedEvaluatorSystemPrompt(): string {
  return appendCalibrationSection(
    EVALUATOR_SYSTEM_PROMPT,
    EVALUATOR_FEW_SHOT_EXAMPLES,
  );
}
