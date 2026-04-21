import { Box, Text } from 'ink';

import {
  GLOBAL_HOTKEYS,
  OVERLAY_HOTKEYS,
  PANEL_HOTKEYS,
} from '../keybindings/hotkeysCatalog.js';
import type { TuiColorMode } from '../state/store.js';

export const HELP_OVERLAY_ID = 'help';

export interface HelpOverlayProps {
  readonly colorMode?: TuiColorMode;
}

export function HelpOverlay({ colorMode = 'color' }: HelpOverlayProps) {
  const useColor = colorMode === 'color';
  const sections = [GLOBAL_HOTKEYS, PANEL_HOTKEYS, OVERLAY_HOTKEYS];

  return (
    <Box flexDirection="column">
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold {...(useColor ? { color: 'cyan' } : {})}>
            {section.title}
          </Text>
          {section.lines.map((line, i) => (
            <Text key={`${section.title}-${i.toString()}`} dimColor={useColor}>
              {`${line.keys}  ${line.description}`}
            </Text>
          ))}
        </Box>
      ))}
      <Text dimColor={useColor}>
        Panel shortcuts apply only when that panel has focus.
      </Text>
    </Box>
  );
}

export function createHelpOverlay(colorMode: TuiColorMode) {
  return {
    id: HELP_OVERLAY_ID,
    title: 'Help — hotkeys',
    render: () => <HelpOverlay colorMode={colorMode} />,
  };
}
