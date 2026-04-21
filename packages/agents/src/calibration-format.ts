import type { FewShotExample } from './definition.js';

function formatFewShots(examples: readonly FewShotExample[]): string {
  return examples
    .map((ex, i) => {
      const note = ex.note ? ` // ${ex.note}` : '';
      return [
        `### Example ${i + 1}${note}`,
        `INPUT: ${JSON.stringify(ex.input)}`,
        `OUTPUT: ${JSON.stringify(ex.output)}`,
      ].join('\n');
    })
    .join('\n\n');
}

/** Appends the same calibration block the runner uses for `AgentDefinition.calibration`. */
export function appendCalibrationSection(
  base: string,
  examples: readonly FewShotExample[] | undefined,
): string {
  if (!examples?.length) return base;
  return `${base}\n\n## Calibration examples\n\n${formatFewShots(examples)}`;
}
