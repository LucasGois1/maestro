import { Box, Text } from 'ink';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useKeybinding } from '../keybindings/useKeybinding.js';
import type { TuiColorMode, TuiFeedbackEntry } from '../state/store.js';

export const FEEDBACK_HISTORY_OVERLAY_ID = 'feedbackHistory';

export interface FeedbackHistoryOverlayProps {
  readonly entries: readonly TuiFeedbackEntry[];
  readonly colorMode?: TuiColorMode;
}

function sprintLabel(idx: number | null): string {
  return idx !== null ? `sprint ${idx.toString()}` : 'sprint ?';
}

function formatEntryHeader(entry: TuiFeedbackEntry): string {
  const sp = sprintLabel(entry.sprintIdx);
  return `${sp} · tent. ${entry.attempt.toString()}`;
}

/** Lines present in `next` but not in `prev` (split by newline). */
function linesOnlyIn(next: string, prev: string): string[] {
  const a = new Set(prev.split('\n').map((s) => s.trim()).filter(Boolean));
  return next
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !a.has(s));
}

export function FeedbackHistoryOverlay({
  entries,
  colorMode = 'color',
}: FeedbackHistoryOverlayProps) {
  const useColor = colorMode === 'color';
  const [pairLeft, setPairLeft] = useState(0);

  const maxPairLeft = Math.max(0, entries.length - 2);
  useEffect(() => {
    setPairLeft((p) => Math.min(p, maxPairLeft));
  }, [entries.length, maxPairLeft]);

  const bumpLeft = useCallback(() => {
    setPairLeft((p) => Math.max(0, p - 1));
  }, []);
  const bumpRight = useCallback(() => {
    setPairLeft((p) => Math.min(maxPairLeft, p + 1));
  }, [maxPairLeft]);

  useKeybinding({ kind: 'overlay' }, { key: '[' }, bumpLeft);
  useKeybinding({ kind: 'overlay' }, { key: ']' }, bumpRight);

  const pair = useMemo(() => {
    if (entries.length < 2) {
      return null;
    }
    const left = entries[pairLeft];
    const right = entries[pairLeft + 1];
    if (!left || !right) {
      return null;
    }
    return { left, right };
  }, [entries, pairLeft]);

  const deltaLines = useMemo(() => {
    if (!pair) {
      return { added: [] as string[], removed: [] as string[] };
    }
    return {
      added: linesOnlyIn(pair.right.failure, pair.left.failure),
      removed: linesOnlyIn(pair.left.failure, pair.right.failure),
    };
  }, [pair]);

  if (entries.length === 0) {
    return <Text dimColor={useColor}>(sem feedback)</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor={useColor} wrap="wrap">
        {entries.length >= 2
          ? `mudar par com [ e ] · par ${(pairLeft + 1).toString()}/${(maxPairLeft + 1).toString()}`
          : 'lista (adicione 2+ entradas para comparar tentativas)'}
      </Text>
      {entries.map((entry, index) => {
        const key = `${entry.at.toString()}-${index.toString()}`;
        const loc =
          entry.file !== null
            ? `${entry.file}${entry.line !== null ? `:${entry.line.toString()}` : ''}`
            : '—';
        return (
          <Box key={key} flexDirection="column" marginBottom={1}>
            <Text dimColor={useColor}>{formatEntryHeader(entry)}</Text>
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

      {pair ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold {...(useColor ? { color: 'cyan' } : {})}>
            Δ entre tentativas
          </Text>
          <Text dimColor={useColor}>
            {`${formatEntryHeader(pair.left)} → ${formatEntryHeader(pair.right)}`}
          </Text>
          {deltaLines.removed.length > 0 ? (
            <Box flexDirection="column">
              <Text {...(useColor ? { color: 'red' } : {})}>só na anterior</Text>
              {deltaLines.removed.map((line, i) => (
                <Text key={`rm-${i.toString()}`} dimColor={useColor}>
                  {`- ${line}`}
                </Text>
              ))}
            </Box>
          ) : null}
          {deltaLines.added.length > 0 ? (
            <Box flexDirection="column" marginTop={1}>
              <Text {...(useColor ? { color: 'green' } : {})}>só na seguinte</Text>
              {deltaLines.added.map((line, i) => (
                <Text key={`add-${i.toString()}`} dimColor={useColor}>
                  {`+ ${line}`}
                </Text>
              ))}
            </Box>
          ) : null}
          {deltaLines.added.length === 0 && deltaLines.removed.length === 0 ? (
            <Text dimColor={useColor}>(texto de falha idêntico entre as duas)</Text>
          ) : null}
        </Box>
      ) : null}
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
