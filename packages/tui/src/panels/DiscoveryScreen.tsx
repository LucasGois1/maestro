import { Box, Text, useInput } from 'ink';

import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiDiscoveryPhase, TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';
import { DiffPreviewPanel } from './DiffPreviewPanel.js';
import { DiscoveryPhaseChecklist } from './DiscoveryPhaseChecklist.js';

/** Honest product copy: discovery does not generate sensors.json yet (DSFT-120). */
export const DISCOVERY_SENSORS_FOOTNOTE =
  'sensors.json — KB default for now; customize manually. Stack-specific sensors (e.g. ruff, pytest) are not auto-generated yet.';

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
  const viewportLines = Math.max(8, size.rows - 18 - streamReserve);
  const streamLines = streamReserve || 6;

  const showNextSteps =
    discovery.phase !== 'error' &&
    discovery.phase !== 'done' &&
    discovery.phase !== 'preview';

  return (
    <Box flexDirection="column" paddingX={1} width={size.columns}>
      <Box marginBottom={1}>
        <Text bold {...(useColor ? { color: 'cyan' } : {})}>
          {'Discovery · '}
        </Text>
        <Text>{phaseLabel}</Text>
      </Box>

      {discovery.providerSummary !== null ? (
        <Box marginBottom={1}>
          <Text dimColor={useColor}>
            <Text bold>Provider: </Text>
            {discovery.providerSummary}
          </Text>
        </Box>
      ) : null}

      <DiscoveryPhaseChecklist phase={discovery.phase} colorMode={colorMode} />

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
          <NextStepsBlock useColor={useColor} />
        </Box>
      ) : null}

      {showNextSteps ? (
        <Box marginBottom={1} flexDirection="column">
          <NextStepsBlock useColor={useColor} />
        </Box>
      ) : null}

      <Box marginTop={showNextSteps ? 0 : 1}>
        <DiscoveryKeysHint phase={discovery.phase} useColor={useColor} />
      </Box>
    </Box>
  );
}

function NextStepsBlock({ useColor }: { readonly useColor: boolean }) {
  return (
    <Box flexDirection="column">
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        Next steps
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        {'• .maestro/AGENTS.md — written on apply'}
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        {'• .maestro/ARCHITECTURE.md — written on apply'}
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        {`• ${DISCOVERY_SENSORS_FOOTNOTE}`}
      </Text>
    </Box>
  );
}

function DiscoveryKeysHint({
  phase,
  useColor,
}: {
  readonly phase: TuiDiscoveryPhase;
  readonly useColor: boolean;
}) {
  let line: string;
  switch (phase) {
    case 'detecting':
    case 'structuring':
    case 'inferring':
      line =
        'Scan running — [Enter] and [q] unlock at preview. ([e] edit: not wired yet)';
      break;
    case 'preview':
    case 'done':
      line =
        '[Enter] apply to .maestro/ · [q] save draft only / cancel · [e] edit: not wired yet';
      break;
    case 'error':
      line = '[q] or Enter — exit · [e] edit: not wired yet';
      break;
    default:
      line = '';
  }
  if (line.length === 0) {
    return null;
  }
  return (
    <Text dimColor={useColor} wrap="wrap">
      {line}
    </Text>
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
