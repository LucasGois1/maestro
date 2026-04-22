import { Box, Text } from 'ink';

import type { TuiColorMode, TuiHeaderState, TuiMode } from '../state/store.js';

export interface HeaderProps {
  readonly mode: TuiMode;
  readonly header: TuiHeaderState;
  readonly colorMode?: TuiColorMode;
  readonly maxBranchLength?: number;
}

const DEFAULT_MAX_BRANCH_LENGTH = 24;

export function Header({
  mode,
  header,
  colorMode = 'color',
  maxBranchLength = DEFAULT_MAX_BRANCH_LENGTH,
}: HeaderProps) {
  const useColor = colorMode === 'color';
  const branch = truncate(header.branch, maxBranchLength);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderColor={useColor ? 'cyan' : undefined}
    >
      <Text>
        <Text bold {...(useColor ? { color: 'cyan' } : {})}>
          {'maestro '}
        </Text>
        <Text>{`· ${header.repoName ?? '—'}`}</Text>
        <Text>{` · ${branch}`}</Text>
      </Text>
      <Text>
        <Text>{formatModeLabel(mode)}</Text>
        {header.sprintIdx !== null && header.totalSprints !== null ? (
          <Text>{` · sprint ${header.sprintIdx.toString()}/${header.totalSprints.toString()}`}</Text>
        ) : null}
        {header.contextPct !== null ? (
          <Text>{` · ctx ${header.contextPct.toString()}%`}</Text>
        ) : null}
        {header.updateAvailable ? (
          <Text {...(useColor ? { color: 'yellow' } : {})}>
            {' · ● update available'}
          </Text>
        ) : null}
      </Text>
    </Box>
  );
}

function truncate(value: string | null, max: number): string {
  if (!value) {
    return '—';
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function formatModeLabel(mode: TuiMode): string {
  switch (mode) {
    case 'idle':
      return 'idle';
    case 'discovery':
      return 'discovery';
    case 'run':
      return 'run';
  }
}
