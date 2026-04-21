import { Box, Text, useInput } from 'ink';
import { useState } from 'react';

import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiColorMode } from '../state/store.js';

export type ListPickerItem = {
  readonly key: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly dimmed?: boolean;
};

export interface ListPickerScreenProps {
  readonly title: string;
  readonly description?: string;
  readonly items: readonly ListPickerItem[];
  readonly initialIndex?: number;
  readonly colorMode?: TuiColorMode;
  readonly onConfirm: (item: ListPickerItem, index: number) => void;
}

export function ListPickerScreen({
  title,
  description,
  items,
  initialIndex = 0,
  colorMode = 'color',
  onConfirm,
}: ListPickerScreenProps) {
  const useColor = colorMode === 'color';
  const size = useTerminalSize();
  const [index, setIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, items.length - 1)),
  );

  useInput(
    (input, key) => {
      if (key.upArrow) {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (key.downArrow) {
        setIndex((i) => (i + 1) % items.length);
        return;
      }
      if (key.return) {
        const item = items[index];
        if (item !== undefined && !item.dimmed) {
          onConfirm(item, index);
        }
        return;
      }
      if (input === 'q' || input === 'Q' || key.escape) {
        const skip = items.find((it) => it.key === 'skip');
        if (skip !== undefined) {
          onConfirm(skip, items.indexOf(skip));
        }
      }
    },
    { isActive: true },
  );

  return (
    <Box flexDirection="column" paddingX={1} width={size.columns}>
      <Box marginBottom={1}>
        <Text bold {...(useColor ? { color: 'cyan' } : {})}>
          {title}
        </Text>
      </Box>
      {description !== undefined ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor} wrap="wrap">
            {description}
          </Text>
        </Box>
      ) : null}
      <Box flexDirection="column">
        {items.map((item, i) => {
          const selected = i === index;
          const prefix = selected ? '› ' : '  ';
          const dim = item.dimmed === true;
          return (
            <Box key={`${item.key}-${String(i)}`} flexDirection="column" marginBottom={0}>
              <Text
                {...(dim ? { dimColor: true } : selected ? { bold: true } : {})}
                {...(useColor && selected && !dim ? { color: 'green' } : {})}
              >
                {prefix}
                {item.title}
              </Text>
              {item.subtitle !== undefined ? (
                <Text dimColor={useColor}>
                  {'   '}
                  {item.subtitle}
                </Text>
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor={useColor}>
          ↑↓ navigate · Enter confirm · q skip (if available)
        </Text>
      </Box>
    </Box>
  );
}
