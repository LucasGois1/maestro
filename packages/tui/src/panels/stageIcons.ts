import type { TuiStageStatus, TuiSprintState } from '../state/store.js';

export interface StageIcon {
  readonly icon: string;
  readonly color: string | null;
  readonly bold: boolean;
}

export const STAGE_ICONS: Readonly<Record<TuiStageStatus, StageIcon>> = {
  pending: { icon: '○', color: null, bold: false },
  running: { icon: '⟳', color: 'cyan', bold: true },
  passed: { icon: '✓', color: 'green', bold: false },
  failed: { icon: '✗', color: 'red', bold: true },
  paused: { icon: '⏸', color: 'yellow', bold: false },
  escalated: { icon: '!', color: 'yellow', bold: true },
};

export type SprintListStatus = TuiSprintState['status'];

export const SPRINT_ICONS: Readonly<Record<SprintListStatus, StageIcon>> = {
  pending: { icon: '○', color: null, bold: false },
  running: { icon: '⟳', color: 'cyan', bold: true },
  done: { icon: '✓', color: 'green', bold: false },
  failed: { icon: '✗', color: 'red', bold: true },
  escalated: { icon: '!', color: 'yellow', bold: true },
};

export function stageLabel(stage: string): string {
  if (stage.length === 0) {
    return stage;
  }
  return `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;
}
