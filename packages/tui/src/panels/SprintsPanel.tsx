import { Box, Text } from 'ink';

import type { TuiColorMode, TuiSprintState } from '../state/store.js';

import { Panel } from './Panel.js';

export interface SprintsPanelProps {
  readonly sprints: readonly TuiSprintState[];
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

export function SprintsPanel({
  sprints,
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
        {sprints.map((sprint) => (
          <Text key={sprint.idx}>
            {`#${sprint.idx.toString().padStart(2, '0')} · ${sprint.status} · retries ${sprint.retries.toString()}`}
          </Text>
        ))}
      </Box>
    </Panel>
  );
}
