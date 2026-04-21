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

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="row" flexGrow={1}>
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
      <Box flexDirection="row" flexGrow={1}>
        <Box flexGrow={1} flexBasis={0}>
          {slots.sensors}
        </Box>
        <Box flexGrow={2} flexBasis={0}>
          {slots.diff}
        </Box>
      </Box>
    </Box>
  );
}
