import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { GENERATOR_SYSTEM_PROMPT } from './system-prompt.js';
import {
  AMBIGUOUS_CONTRACT,
  MULTI_LAYER,
  SELF_EVAL_GAPS,
  SIMPLE_ONE_FILE,
  WITH_EVALUATOR_FEEDBACK,
} from './fixtures-data.js';

export const GENERATOR_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: SIMPLE_ONE_FILE.input,
    output: SIMPLE_ONE_FILE.output,
    note: 'sprint simples — um ficheiro novo',
  },
  {
    input: MULTI_LAYER.input,
    output: MULTI_LAYER.output,
    note: 'várias camadas / pacotes',
  },
  {
    input: SELF_EVAL_GAPS.input,
    output: SELF_EVAL_GAPS.output,
    note: 'auto-avaliação honesta — lacunas',
  },
  {
    input: WITH_EVALUATOR_FEEDBACK.input,
    output: WITH_EVALUATOR_FEEDBACK.output,
    note: 'retry com feedback do evaluator',
  },
  {
    input: AMBIGUOUS_CONTRACT.input,
    output: AMBIGUOUS_CONTRACT.output,
    note: 'ambiguidade — não inventar; concerns explícitos',
  },
];

export function resolvedGeneratorSystemPrompt(): string {
  return appendCalibrationSection(
    GENERATOR_SYSTEM_PROMPT,
    GENERATOR_FEW_SHOT_EXAMPLES,
  );
}
