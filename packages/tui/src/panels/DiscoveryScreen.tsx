import { Box, Text, useInput } from 'ink';

import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiDiscoveryPhase, TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';
import { DiffPreviewPanel } from './DiffPreviewPanel.js';

export interface DiscoveryScreenProps {
  readonly store: TuiStore;
  readonly onChoice: (choice: 'accept' | 'cancel') => void;
}

export function DiscoveryScreen({ store, onChoice }: DiscoveryScreenProps) {
  const discovery = useStoreSelector(store, (s) => s.discovery);
  const diffPreview = useStoreSelector(store, (s) => s.diffPreview);
  const colorMode = useStoreSelector(store, (s) => s.colorMode);
  const size = useTerminalSize();

  const canChoose =
    discovery.phase === 'preview' ||
    discovery.phase === 'error' ||
    discovery.phase === 'done';

  useInput(
    (input, key) => {
      if (!canChoose) {
        return;
      }
      if (key.return) {
        if (discovery.phase === 'error') {
          onChoice('cancel');
          return;
        }
        onChoice('accept');
        return;
      }
      if (input === 'q' || input === 'Q' || key.escape) {
        onChoice('cancel');
      }
    },
    { isActive: canChoose },
  );

  const useColor = colorMode === 'color';
  const phaseLabel = formatPhase(discovery.phase);
  const streamReserve =
    discovery.phase === 'inferring'
      ? Math.min(10, Math.max(4, Math.floor(size.rows / 5)))
      : 0;
  const viewportLines = Math.max(8, size.rows - 12 - streamReserve);
  const streamLines = streamReserve || 6;

  return (
    <Box flexDirection="column" paddingX={1} width={size.columns}>
      <Box marginBottom={1}>
        <Text bold {...(useColor ? { color: 'cyan' } : {})}>
          {'Discovery · '}
        </Text>
        <Text>{phaseLabel}</Text>
      </Box>

      {discovery.progressHint !== null && discovery.phase === 'inferring' ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor} wrap="wrap">
            {discovery.progressHint}
          </Text>
        </Box>
      ) : null}

      {discovery.stackSummary !== null ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor}>
            <Text bold>Stack: </Text>
            {discovery.stackSummary}
          </Text>
        </Box>
      ) : null}

      {discovery.structureSummary !== null ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor} wrap="wrap">
            <Text bold>Structure: </Text>
            {discovery.structureSummary}
          </Text>
        </Box>
      ) : null}

      {discovery.phase === 'inferring' &&
      discovery.agentStreamTail !== null &&
      discovery.agentStreamTail.length > 0 ? (
        <Box
          marginBottom={1}
          flexDirection="column"
          borderStyle="round"
          borderColor={useColor ? 'gray' : undefined}
          paddingX={1}
          width={size.columns - 4}
        >
          <Text bold dimColor={useColor}>
            Live model output (latest)
          </Text>
          <Box flexDirection="column">
            <Text dimColor={useColor} wrap="wrap">
              {tailForDisplay(
                discovery.agentStreamTail,
                streamLines * 400,
                size.columns - 6,
              )}
            </Text>
          </Box>
        </Box>
      ) : discovery.phase === 'inferring' ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor}>
            Inferring AGENTS.md & ARCHITECTURE.md (streaming)…
          </Text>
        </Box>
      ) : null}

      {discovery.phase === 'error' ? (
        <Box marginBottom={1} flexDirection="column">
          <Text bold {...(useColor ? { color: 'red' } : {})}>
            {discovery.errorSummary ?? 'Discovery failed'}
          </Text>
          {discovery.errorDetail !== null ? (
            <Box marginTop={1} flexDirection="column">
              <Text dimColor={useColor} wrap="wrap">
                {discovery.errorDetail}
              </Text>
            </Box>
          ) : null}
          {discovery.logFilePath !== null ? (
            <Box marginTop={1}>
              <Text dimColor={useColor} wrap="wrap">
                Full log: {discovery.logFilePath}
              </Text>
            </Box>
          ) : null}
          <Box marginTop={1}>
            <Text dimColor={useColor}>Press q to exit.</Text>
          </Box>
        </Box>
      ) : null}

      {discovery.phase === 'preview' ? (
        <Box flexDirection="column" flexGrow={1}>
          <Box marginBottom={1}>
            <Text bold>Preview</Text>
          </Box>
          <Box flexDirection="column">
            <DiffPreviewPanel
              diffPreview={diffPreview}
              focused
              colorMode={colorMode}
              viewportLines={viewportLines}
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor={useColor}>
              [Enter] apply to .maestro/ · [q] save draft only / cancel
            </Text>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

function tailForDisplay(text: string, maxChars: number, maxCols: number): string {
  const slice = text.length > maxChars ? text.slice(-maxChars) : text;
  const lines = slice.split('\n');
  const capLine = (line: string) =>
    line.length > maxCols ? `${line.slice(0, Math.max(0, maxCols - 1))}…` : line;
  return lines.map(capLine).join('\n');
}

function formatPhase(phase: TuiDiscoveryPhase): string {
  switch (phase) {
    case 'detecting':
      return 'detecting stack';
    case 'structuring':
      return 'analysing structure';
    case 'inferring':
      return 'inferring documentation';
    case 'preview':
      return 'preview changes';
    case 'done':
      return 'done';
    case 'error':
      return 'error';
    default:
      return phase;
  }
}
