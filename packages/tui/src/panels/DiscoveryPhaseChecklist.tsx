import { Box, Text } from 'ink';

import {
  getDiscoveryChecklist,
  type DiscoveryChecklistItemStatus,
  type TuiColorMode,
  type TuiDiscoveryPhase,
} from '../state/store.js';

export interface DiscoveryPhaseChecklistProps {
  readonly phase: TuiDiscoveryPhase;
  readonly colorMode: TuiColorMode;
}

export function DiscoveryPhaseChecklist({
  phase,
  colorMode,
}: DiscoveryPhaseChecklistProps) {
  const useColor = colorMode === 'color';
  const rows = getDiscoveryChecklist(phase);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        Phases
      </Text>
      {rows.map((row) => (
        <Box key={row.id}>
          <Text dimColor={useColor}>
            {glyphForStatus(row.status)} {row.label}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function glyphForStatus(status: DiscoveryChecklistItemStatus): string {
  switch (status) {
    case 'done':
      return '[✓]';
    case 'current':
      return '[⟳]';
    case 'failed':
      return '[!]';
    case 'pending':
    default:
      return '[·]';
  }
}
