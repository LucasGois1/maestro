import { Box, Text } from 'ink';

import { PIPELINE_FOOTER_HINTS } from '../keybindings/hotkeysCatalog.js';
import type {
  TuiColorMode,
  TuiPipelineStatus,
} from '../state/store.js';

export type FooterState = 'idle' | 'running' | 'paused' | 'overlay';

export interface FooterProps {
  readonly state: FooterState;
  readonly colorMode?: TuiColorMode;
}

export function Footer({ state, colorMode = 'color' }: FooterProps) {
  const useColor = colorMode === 'color';
  const hotkeys = HOTKEYS_BY_STATE[state];
  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle="single"
      borderColor={useColor ? 'gray' : undefined}
    >
      <Text dimColor={useColor}>
        {hotkeys
          .map(({ key, label }) => `${key} ${label}`)
          .join('  ·  ')}
      </Text>
    </Box>
  );
}

export function deriveFooterState(
  pipelineStatus: TuiPipelineStatus,
  overlayOpen: boolean,
): FooterState {
  if (overlayOpen) {
    return 'overlay';
  }
  switch (pipelineStatus) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'idle':
    case 'completed':
    case 'failed':
      return 'idle';
  }
}

const HOTKEYS_BY_STATE: Readonly<
  Record<
    FooterState,
    readonly { readonly key: string; readonly label: string }[]
  >
> = {
  idle: PIPELINE_FOOTER_HINTS.idle,
  running: PIPELINE_FOOTER_HINTS.running,
  paused: PIPELINE_FOOTER_HINTS.paused,
  overlay: [
    { key: '[esc]', label: 'close' },
    { key: '[q]', label: 'close' },
    { key: '[↑↓]', label: 'navigate' },
    { key: '[enter]', label: 'select' },
  ],
};
