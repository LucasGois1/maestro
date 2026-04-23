import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

import { isNarrowTerminal, useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';

export interface MaestroHomeScreenProps {
  readonly store: TuiStore;
  /** Shown next to the product name (e.g. from CLI package.json). */
  readonly maestroVersion?: string;
}

const LOGO_LINES = ['  ▗ ▗   ▖ ▖  ', '    ▘▘ ▝▝    ', '            '] as const;

function truncateMiddle(id: string, maxLen: number): string {
  if (id.length <= maxLen) {
    return id;
  }
  const keep = Math.max(4, maxLen - 1);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  return `${id.slice(0, head)}…${id.slice(id.length - tail)}`;
}

function firstLine(text: string): string {
  const line = text.split('\n')[0]?.trim() ?? '';
  return line.length <= 120 ? line : `${line.slice(0, 119)}…`;
}

export function MaestroHomeScreen({
  store,
  maestroVersion,
}: MaestroHomeScreenProps): ReactNode {
  const size = useTerminalSize();
  const useColor = useStoreSelector(store, (s) => s.colorMode === 'color');
  const header = useStoreSelector(store, (s) => s.header);
  const pipeline = useStoreSelector(store, (s) => s.pipeline);
  const runId = useStoreSelector(store, (s) => s.runId);
  const diffPreview = useStoreSelector(store, (s) => s.diffPreview);
  const recentRuns = useStoreSelector(store, (s) => s.recentRuns);

  const narrow = isNarrowTerminal(size);
  const innerWidth = Math.max(20, size.columns - 4);
  const versionLabel =
    maestroVersion !== undefined && maestroVersion.length > 0
      ? maestroVersion
      : 'dev';

  const repoLine =
    header.repoName !== null || header.branch !== null
      ? `${header.repoName ?? '—'} · ${header.branch ?? '—'}`
      : '— · —';

  const showLastRun =
    runId !== null &&
    (pipeline.status === 'completed' || pipeline.status === 'failed');

  const lastRunLines: string[] = [];
  if (showLastRun) {
    lastRunLines.push(
      `Run ${truncateMiddle(runId, 36)} — ${pipeline.status === 'completed' ? 'completed' : 'failed'}`,
    );
    if (pipeline.status === 'failed' && pipeline.error !== null) {
      lastRunLines.push(firstLine(pipeline.error));
    }
    if (diffPreview.activePath !== null) {
      lastRunLines.push(`Last diff: ${truncateMiddle(diffPreview.activePath, 56)}`);
    }
  }

  const leftColumn = (
    <Box flexDirection="column" flexGrow={1} minWidth={narrow ? undefined : 28}>
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        Maestro {versionLabel}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {LOGO_LINES.map((line, i) => (
          <Text key={i} dimColor={useColor}>
            {line}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text bold>Welcome</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor={useColor} wrap="wrap">
          {repoLine}
        </Text>
      </Box>
      {showLastRun ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold {...(useColor ? { color: 'cyan' } : {})}>
            Last run
          </Text>
          {lastRunLines.map((line, i) => (
            <Text key={i} dimColor={useColor} wrap="wrap">
              {line}
            </Text>
          ))}
        </Box>
      ) : null}
    </Box>
  );

  const tips = (
    <Box flexDirection="column" marginTop={narrow ? 1 : 0}>
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        Tips for getting started
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        • Type ? for help and shortcuts (command line)
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        • Use /run followed by your task to start a pipeline
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        • Use /resume when a run is available to continue
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        • Run maestro init to configure AGENTS, architecture, and sensors
      </Text>
    </Box>
  );

  const recentBlock = (
    <Box flexDirection="column" marginTop={1}>
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        Recent activity
      </Text>
      {recentRuns.length === 0 ? (
        <Text dimColor={useColor} wrap="wrap">
          No recent activity
        </Text>
      ) : (
        recentRuns.map((r) => (
          <Text key={`${r.runId}-${r.at}`} dimColor={useColor} wrap="wrap">
            {`• ${truncateMiddle(r.runId, 32)} — ${r.status}`}
            {r.durationMs !== undefined
              ? ` (${r.durationMs.toString()} ms)`
              : ''}
          </Text>
        ))
      )}
    </Box>
  );

  const rightColumn = (
    <Box flexDirection="column" flexGrow={1}>
      {tips}
      {recentBlock}
    </Box>
  );

  return (
    <Box flexDirection="column" paddingX={1} width={size.columns}>
      <Box
        flexDirection={narrow ? 'column' : 'row'}
        borderStyle="round"
        borderColor={useColor ? 'cyan' : undefined}
        paddingX={1}
        paddingY={1}
        width={innerWidth}
      >
        {leftColumn}
        {!narrow ? (
          <Box marginLeft={2} marginRight={1}>
            <Text dimColor={useColor}>│</Text>
          </Box>
        ) : null}
        {rightColumn}
      </Box>
      <Box marginTop={1}>
        <Text dimColor={useColor} wrap="wrap">
          After init: tune sensors in .maestro/sensors.json and use /run to start work.
        </Text>
      </Box>
    </Box>
  );
}
