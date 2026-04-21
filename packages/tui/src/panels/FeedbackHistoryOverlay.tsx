import { Box, Text } from 'ink';

import type { TuiColorMode, TuiFeedbackEntry } from '../state/store.js';

export const FEEDBACK_HISTORY_OVERLAY_ID = 'feedbackHistory';

export interface FeedbackHistoryOverlayProps {
  readonly entries: readonly TuiFeedbackEntry[];
  readonly colorMode?: TuiColorMode;
}

export function FeedbackHistoryOverlay({
  entries,
  colorMode = 'color',
}: FeedbackHistoryOverlayProps) {
  const useColor = colorMode === 'color';
  if (entries.length === 0) {
    return <Text dimColor={useColor}>(sem feedback)</Text>;
  }

  return (
    <Box flexDirection="column">
      {entries.map((entry, index) => {
        const key = `${entry.at.toString()}-${index.toString()}`;
        const loc =
          entry.file !== null
            ? `${entry.file}${entry.line !== null ? `:${entry.line.toString()}` : ''}`
            : '—';
        return (
          <Box key={key} flexDirection="column" marginBottom={1}>
            <Text {...(useColor ? { color: 'yellow' as const } : {})}>
              {`★ ${entry.criterion}`}
            </Text>
            <Text dimColor={useColor}>{entry.failure}</Text>
            <Text dimColor={useColor}>{`local: ${loc}`}</Text>
            {entry.suggestedAction ? (
              <Text dimColor={useColor}>{`ação: ${entry.suggestedAction}`}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export function createFeedbackHistoryOverlay(
  entries: readonly TuiFeedbackEntry[],
  colorMode: TuiColorMode,
) {
  return {
    id: FEEDBACK_HISTORY_OVERLAY_ID,
    title: 'Feedback — histórico',
    render: () => (
      <FeedbackHistoryOverlay entries={entries} colorMode={colorMode} />
    ),
  };
}
