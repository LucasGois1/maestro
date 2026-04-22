import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import type { TuiColorMode } from '../state/store.js';

export interface PanelProps {
  readonly title: string;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
  readonly footerHint?: string;
  readonly children?: ReactNode;
  readonly testId?: string;
  /** When set, the panel stretches inside a flex parent (e.g. diff column). */
  readonly flexGrow?: number;
}

export function Panel({
  title,
  focused = false,
  colorMode = 'color',
  footerHint,
  children,
  testId,
  flexGrow,
}: PanelProps) {
  const useColor = colorMode === 'color';
  const borderColor = useColor ? (focused ? 'cyan' : 'gray') : undefined;
  const titleMarker = focused ? '◉' : '○';
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      {...(flexGrow !== undefined ? { flexGrow } : {})}
    >
      <Box paddingX={1}>
        <Text
          bold={useColor && focused}
          {...(useColor ? { color: 'white' } : {})}
        >
          {`${titleMarker} ${title}`}
        </Text>
        {testId ? <Text>{` [${testId}]`}</Text> : null}
      </Box>
      <Box
        flexDirection="column"
        paddingX={1}
        {...(flexGrow !== undefined ? { flexGrow: 1 } : {})}
      >
        {children ?? <Text dimColor={useColor}>—</Text>}
      </Box>
      {footerHint ? (
        <Box paddingX={1}>
          <Text dimColor={useColor}>{footerHint}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
