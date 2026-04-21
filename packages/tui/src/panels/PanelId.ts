import { PANEL_FOCUS_ORDER, type TuiPanelId } from '../state/store.js';

export { PANEL_FOCUS_ORDER, type TuiPanelId };

const FIRST_PANEL: TuiPanelId = PANEL_FOCUS_ORDER[0] ?? 'pipeline';

function panelAt(index: number): TuiPanelId {
  return PANEL_FOCUS_ORDER[index] ?? FIRST_PANEL;
}

export function nextPanelId(current: TuiPanelId): TuiPanelId {
  const index = PANEL_FOCUS_ORDER.indexOf(current);
  if (index === -1) {
    return FIRST_PANEL;
  }
  return panelAt((index + 1) % PANEL_FOCUS_ORDER.length);
}

export function previousPanelId(current: TuiPanelId): TuiPanelId {
  const index = PANEL_FOCUS_ORDER.indexOf(current);
  if (index === -1) {
    return FIRST_PANEL;
  }
  const prevIndex =
    (index - 1 + PANEL_FOCUS_ORDER.length) % PANEL_FOCUS_ORDER.length;
  return panelAt(prevIndex);
}

export const PANEL_TITLES: Readonly<Record<TuiPanelId, string>> = {
  pipeline: 'Pipeline',
  activeAgent: 'Active Agent',
  sprints: 'Sprints',
  sensors: 'Sensors',
  diff: 'Diff · Preview · Feedback',
};
