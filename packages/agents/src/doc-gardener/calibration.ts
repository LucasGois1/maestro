import { appendCalibrationSection } from '../calibration-format.js';
import { DOC_GARDENER_SYSTEM_PROMPT } from './system-prompt.js';
import { FIXTURE_CODE_DRIFT, FIXTURE_DOC_LINKS } from './fixtures-data.js';

export const DOC_GARDENER_FEW_SHOT_EXAMPLES = [
  {
    input: FIXTURE_DOC_LINKS.input,
    output: FIXTURE_DOC_LINKS.output,
    note: 'doc: broken links',
  },
  {
    input: FIXTURE_CODE_DRIFT.input,
    output: FIXTURE_CODE_DRIFT.output,
    note: 'code: duplication',
  },
] as const;

export function resolvedDocGardenerSystemPrompt(): string {
  return appendCalibrationSection(DOC_GARDENER_SYSTEM_PROMPT, [
    ...DOC_GARDENER_FEW_SHOT_EXAMPLES,
  ]);
}
