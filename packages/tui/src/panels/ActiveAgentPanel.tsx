import { Box, Text } from 'ink';

import type { PipelineStageName } from '@maestro/core';

import { useSpinnerFrame } from '../hooks/useSpinnerFrame.js';
import type {
  TuiAgentLogEntry,
  TuiAgentState,
  TuiColorMode,
  TuiPipelineStatus,
} from '../state/store.js';

import { activeAgentWorkingHint } from './activeAgentWorkingHint.js';
import { Panel } from './Panel.js';

export interface ActiveAgentPanelProps {
  readonly agent: TuiAgentState;
  /** Current pipeline stage (for working hints when the log is still empty). */
  readonly pipelineStage?: PipelineStageName | null;
  readonly pipelineStatus?: TuiPipelineStatus;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
  readonly maxLines?: number;
}

const DEFAULT_MAX_LINES = 10;
const MAX_ENTRY_CHARS = 120;

function truncateEntry(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_ENTRY_CHARS) {
    return clean;
  }
  return `${clean.slice(0, MAX_ENTRY_CHARS - 1)}…`;
}

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

export function ActiveAgentPanel({
  agent,
  pipelineStage = null,
  pipelineStatus = 'idle',
  focused = false,
  colorMode = 'color',
  maxLines = DEFAULT_MAX_LINES,
}: ActiveAgentPanelProps) {
  const useColor = colorMode === 'color';
  const visible = agent.messageLog.slice(-maxLines);
  const lastDecision =
    agent.decisions.length > 0 ? agent.decisions.at(-1) : undefined;
  const pipelineRunning = pipelineStatus === 'running';
  const spinnerEnabled =
    pipelineRunning && agent.activeAgentId !== null;
  const spinner = useSpinnerFrame({ enabled: spinnerEnabled });
  const workingHint =
    agent.activeAgentId !== null
      ? activeAgentWorkingHint(agent.activeAgentId, pipelineStage)
      : '';

  return (
    <Panel
      title={`Active Agent: ${agent.activeAgentId ?? '—'}`}
      focused={focused}
      colorMode={colorMode}
    >
      {spinnerEnabled ? (
        <Text {...(useColor ? { color: 'cyan' } : {})}>
          {spinner.length > 0 ? `${spinner} ` : ''}
          {workingHint}
        </Text>
      ) : null}
      {visible.length === 0 ? (
        agent.activeAgentId === null ? (
          <Text dimColor={useColor}>(sem agente ativo)</Text>
        ) : spinnerEnabled ? (
          <Text dimColor={useColor}>
            A aguardar tokens ou ferramentas do agente…
          </Text>
        ) : (
          <Text dimColor={useColor}>(sem saída ainda)</Text>
        )
      ) : (
        <Box flexDirection="column">
          {visible.map((entry, index) => {
            const prefix = entryPrefix(entry.kind);
            const text = truncateEntry(entry.text);
            const key = `${entry.at.toString()}-${index.toString()}-${entry.kind}`;
            if (entry.kind === 'decision') {
              return (
                <Text key={key} {...(useColor ? { color: 'yellow' } : {})} bold>
                  {`${prefix} ${text}`}
                </Text>
              );
            }
            if (entry.kind === 'tool_call') {
              return (
                <Text key={key} {...(useColor ? { color: 'cyan' } : {})}>
                  {`${prefix} ${text}`}
                </Text>
              );
            }
            return (
              <Text key={key} dimColor={useColor}>
                {`${prefix} ${text}`}
              </Text>
            );
          })}
        </Box>
      )}
      {lastDecision ? (
        <Text dimColor={useColor}>
          {`última decisão: "${truncateEntry(lastDecision.message)}"`}
        </Text>
      ) : null}
      {agent.error ? (
        <Text {...(useColor ? { color: 'red' } : {})}>
          {`error: ${agent.error}`}
        </Text>
      ) : null}
      {focused ? <Text dimColor={useColor}>[l] logs completos</Text> : null}
    </Panel>
  );
}
