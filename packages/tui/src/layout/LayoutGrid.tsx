import { Box } from 'ink';
import type { ReactNode } from 'react';

import type { TuiPanelId } from '../state/store.js';

import { isNarrowTerminal, useTerminalSize } from './useTerminalSize.js';

export interface LayoutGridSlots {
  readonly pipeline: ReactNode;
  readonly activeAgent: ReactNode;
  readonly sprints: ReactNode;
  readonly sensors: ReactNode;
  readonly diff: ReactNode;
}

export interface LayoutGridProps {
  readonly slots: LayoutGridSlots;
  readonly focusedPanelId?: TuiPanelId;
}

export function LayoutGrid({ slots }: LayoutGridProps) {
  const size = useTerminalSize();

  if (isNarrowTerminal(size)) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box>{slots.pipeline}</Box>
        <Box>{slots.activeAgent}</Box>
        <Box>{slots.sprints}</Box>
        <Box>{slots.sensors}</Box>
        <Box>{slots.diff}</Box>
      </Box>
    );
  }

  // Wide: dedicated right column for diff (full height); other panels stack on the left.
  // Left:right flex 3:2 so the three top panels keep enough width at ~120 cols.
  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" flexGrow={3} flexBasis={0}>
        <Box flexDirection="row" flexGrow={1} flexBasis={0}>
          <Box flexGrow={1} flexBasis={0}>
            {slots.pipeline}
          </Box>
          <Box flexGrow={2} flexBasis={0}>
            {slots.activeAgent}
          </Box>
          <Box flexGrow={1} flexBasis={0}>
            {slots.sprints}
          </Box>
        </Box>
        <Box flexGrow={1} flexBasis={0}>
          {slots.sensors}
        </Box>
      </Box>
      <Box flexGrow={2} flexBasis={0} flexDirection="column">
        <Box flexGrow={1} flexBasis={0} flexDirection="column">
          {slots.diff}
        </Box>
      </Box>
    </Box>
  );
}
