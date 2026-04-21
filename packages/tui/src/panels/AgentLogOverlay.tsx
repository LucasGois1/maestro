import { Box, Text } from 'ink';

import type {
  TuiAgentLogEntry,
  TuiAgentState,
  TuiColorMode,
} from '../state/store.js';

export const AGENT_LOG_OVERLAY_ID = 'agentLog';

export interface AgentLogOverlayProps {
  readonly agent: TuiAgentState;
  readonly colorMode?: TuiColorMode;
  readonly maxEntries?: number;
}

const DEFAULT_MAX_ENTRIES = 80;

function entryPrefix(kind: TuiAgentLogEntry['kind']): string {
  switch (kind) {
    case 'delta':
      return '>';
    case 'tool_call':
      return '►';
    case 'decision':
      return '★';
  }
}

export function AgentLogOverlay({
  agent,
  colorMode = 'color',
  maxEntries = DEFAULT_MAX_ENTRIES,
}: AgentLogOverlayProps) {
  const useColor = colorMode === 'color';
  const entries = agent.messageLog.slice(-maxEntries);

  if (entries.length === 0) {
    return <Text dimColor={useColor}>(log vazio)</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor={useColor}>
        {`agent: ${agent.activeAgentId ?? '—'} · ${entries.length.toString()} entries`}
      </Text>
      {entries.map((entry, index) => {
        const key = `${entry.at.toString()}-${index.toString()}-${entry.kind}`;
        const prefix = entryPrefix(entry.kind);
        const text = entry.text.replace(/\s+/g, ' ').trim();
        const colorProps =
          useColor && entry.kind === 'decision'
            ? { color: 'yellow' as const }
            : useColor && entry.kind === 'tool_call'
              ? { color: 'cyan' as const }
              : {};
        return (
          <Text key={key} {...colorProps} dimColor={entry.kind === 'delta' && useColor}>
            {`${prefix} ${text}`}
          </Text>
        );
      })}
    </Box>
  );
}

export function createAgentLogOverlay(
  agent: TuiAgentState,
  colorMode: TuiColorMode,
) {
  return {
    id: AGENT_LOG_OVERLAY_ID,
    title: 'Logs completos',
    render: () => <AgentLogOverlay agent={agent} colorMode={colorMode} />,
  };
}
