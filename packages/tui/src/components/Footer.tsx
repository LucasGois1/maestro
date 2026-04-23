import { Box, Text } from 'ink';

import { PIPELINE_FOOTER_HINTS } from '../keybindings/hotkeysCatalog.js';
import type { TuiColorMode, TuiPipelineStatus } from '../state/store.js';

export type FooterState = 'idle' | 'running' | 'paused' | 'overlay';

export interface FooterProps {
  readonly state: FooterState;
  readonly colorMode?: TuiColorMode;
  /** Shown instead of empty pipeline hints (e.g. double Control-C exit prompt). */
  readonly transientMessage?: string | null;
}

export function Footer({
  state,
  colorMode = 'color',
  transientMessage = null,
}: FooterProps) {
  const useColor = colorMode === 'color';
  const hotkeys = HOTKEYS_BY_STATE[state];
  const line =
    transientMessage !== null && transientMessage.length > 0
      ? transientMessage
      : hotkeys.map(({ key, label }) => `${key} ${label}`).join('  ·  ');
  if (line.length === 0) {
    return null;
  }
  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle="single"
      borderColor={useColor ? 'gray' : undefined}
    >
      <Text dimColor={useColor}>{line}</Text>
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
    case 'escalated':
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
