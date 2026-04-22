import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

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

function emptyLogPlaceholder(options: {
  readonly activeAgentId: string | null;
  readonly showWorkingSpinner: boolean;
  readonly spinner: string;
  readonly pipelineStage: PipelineStageName | null;
  readonly useColor: boolean;
}): ReactNode {
  if (options.activeAgentId === null) {
    return <Text dimColor={options.useColor}>(sem agente ativo)</Text>;
  }
  if (options.showWorkingSpinner) {
    return (
      <Box flexDirection="column">
        <Text {...(options.useColor ? { color: 'cyan' } : {})}>
          {options.spinner.length > 0 ? `${options.spinner} ` : ''}
          {activeAgentWorkingHint(
            options.activeAgentId,
            options.pipelineStage,
          )}
        </Text>
        <Text dimColor={options.useColor}>
          A aguardar tokens ou ferramentas do agente…
        </Text>
      </Box>
    );
  }
  return <Text dimColor={options.useColor}>(sem saída ainda)</Text>;
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
  const showWorkingSpinner =
    pipelineRunning &&
    agent.activeAgentId !== null &&
    visible.length === 0;
  const spinner = useSpinnerFrame({ enabled: showWorkingSpinner });

  return (
    <Panel
      title={`Active Agent: ${agent.activeAgentId ?? '—'}`}
      focused={focused}
      colorMode={colorMode}
    >
      {visible.length === 0 ? (
        emptyLogPlaceholder({
          activeAgentId: agent.activeAgentId,
          showWorkingSpinner,
          spinner,
          pipelineStage,
          useColor,
        })
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
