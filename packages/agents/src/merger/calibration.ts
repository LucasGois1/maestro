import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { MERGER_SYSTEM_PROMPT } from './system-prompt.js';
import {
  FIXTURE_COMPLETED_GH,
  FIXTURE_DRAFT,
  FIXTURE_GITLAB,
  FIXTURE_NO_REMOTE,
  FIXTURE_PARTIAL,
} from './fixtures-data.js';

export const MERGER_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: FIXTURE_COMPLETED_GH.input,
    output: FIXTURE_COMPLETED_GH.output,
    note: 'GitHub PR criado',
  },
  {
    input: FIXTURE_NO_REMOTE.input,
    output: FIXTURE_NO_REMOTE.output,
    note: 'sem remote',
  },
  {
    input: FIXTURE_DRAFT.input,
    output: FIXTURE_DRAFT.output,
    note: 'draft PR',
  },
  {
    input: FIXTURE_GITLAB.input,
    output: FIXTURE_GITLAB.output,
    note: 'GitLab MR',
  },
  {
    input: FIXTURE_PARTIAL.input,
    output: FIXTURE_PARTIAL.output,
    note: 'partial / retries',
  },
];

export function resolvedMergerSystemPrompt(): string {
  return appendCalibrationSection(
    MERGER_SYSTEM_PROMPT,
    MERGER_FEW_SHOT_EXAMPLES,
  );
}
