import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { ARCHITECT_SYSTEM_PROMPT } from './system-prompt.js';
import {
  DOC_IN_PLACE,
  FITS_LAYERS,
  LOW_LAYER_FIRST,
  NEW_LIB,
  VIOLATION_REFACTOR,
} from './fixtures-data.js';

export const ARCHITECT_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: FITS_LAYERS.input,
    output: FITS_LAYERS.output,
    note: 'encaixa nas camadas',
  },
  {
    input: VIOLATION_REFACTOR.input,
    output: VIOLATION_REFACTOR.output,
    note: 'violaria boundary → refactor_needed',
  },
  {
    input: NEW_LIB.input,
    output: NEW_LIB.output,
    note: 'nova biblioteca com justificação',
  },
  {
    input: LOW_LAYER_FIRST.input,
    output: LOW_LAYER_FIRST.output,
    note: 'dependência de camada baixa → sprint prévio',
  },
  {
    input: DOC_IN_PLACE.input,
    output: DOC_IN_PLACE.output,
    note: 'doc existente — filesToTouch in-place, newFiles vazio',
  },
];

export function resolvedArchitectSystemPrompt(): string {
  return appendCalibrationSection(
    ARCHITECT_SYSTEM_PROMPT,
    ARCHITECT_FEW_SHOT_EXAMPLES,
  );
}
