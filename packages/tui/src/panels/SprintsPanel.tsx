import { Box, Text } from 'ink';

import type { TuiColorMode, TuiSprintState } from '../state/store.js';

import { Panel } from './Panel.js';
import { SPRINT_ICONS } from './stageIcons.js';

export interface SprintsPanelProps {
  readonly sprints: readonly TuiSprintState[];
  readonly selectedSprintIdx?: number | null;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

export function SprintsPanel({
  sprints,
  selectedSprintIdx = null,
  focused = false,
  colorMode = 'color',
}: SprintsPanelProps) {
  const useColor = colorMode === 'color';

  if (sprints.length === 0) {
    return (
      <Panel title="Sprints" focused={focused} colorMode={colorMode}>
        <Text dimColor={useColor}>no sprints scheduled</Text>
      </Panel>
    );
  }

  return (
    <Panel title="Sprints" focused={focused} colorMode={colorMode}>
      <Box flexDirection="column">
        {sprints.map((sprint) => {
          const icon = SPRINT_ICONS[sprint.status];
          const isSelected = selectedSprintIdx === sprint.idx;
          const retrySuffix =
            sprint.retries > 0 ? ` ⟳${sprint.retries.toString()}` : '';
          const textProps = {
            ...(useColor && icon.color ? { color: icon.color } : {}),
            ...(isSelected || icon.bold ? { bold: true } : {}),
            ...(isSelected ? { inverse: true } : {}),
          };
          const idxLabel = `#${sprint.idx.toString().padStart(2, '0')}`;
          return (
            <Text key={sprint.idx} {...textProps}>
              {`${idxLabel} ${icon.icon} sprint ${sprint.idx.toString()} · ${sprint.status}${retrySuffix}`}
            </Text>
          );
        })}
      </Box>
      {focused ? (
        <Text dimColor={useColor}>Ver sprint → [N]</Text>
      ) : null}
    </Panel>
  );
}
