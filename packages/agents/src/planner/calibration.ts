import type { FewShotExample } from '../definition.js';
import { appendCalibrationSection } from '../calibration-format.js';
import { PLANNER_SYSTEM_PROMPT } from './system-prompt.js';
import {
  CONTRADICTION,
  IMPLICIT_SCOPE,
  NARROW_DELIVERY,
  SIMPLE,
  VAGUE,
} from './fixtures-data.js';

/** Few-shot pairs wired into `plannerAgent.calibration` (DSFT-90). */
export const PLANNER_FEW_SHOT_EXAMPLES: readonly FewShotExample[] = [
  {
    input: NARROW_DELIVERY.input,
    output: NARROW_DELIVERY.output,
    note: 'tarefa fechada → 1 sprint com entrega visível',
  },
  {
    input: SIMPLE.input,
    output: SIMPLE.output,
    note: 'produto maior → vários sprints com dependência',
  },
  {
    input: IMPLICIT_SCOPE.input,
    output: IMPLICIT_SCOPE.output,
    note: 'escopo implícito',
  },
  {
    input: VAGUE.input,
    output: VAGUE.output,
    note: 'vago → entrevista inicial',
  },
  {
    input: CONTRADICTION.input,
    output: CONTRADICTION.output,
    note: 'contraditório → escalation',
  },
];

/** Full system string after calibration (for snapshot tests; mirrors `runAgent`). */
export function resolvedPlannerSystemPrompt(): string {
  return appendCalibrationSection(
    PLANNER_SYSTEM_PROMPT,
    PLANNER_FEW_SHOT_EXAMPLES,
  );
}
