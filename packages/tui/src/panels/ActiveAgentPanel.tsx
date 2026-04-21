import { Text } from 'ink';

import type { TuiAgentState, TuiColorMode } from '../state/store.js';

import { Panel } from './Panel.js';

export interface ActiveAgentPanelProps {
  readonly agent: TuiAgentState;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

const MAX_DELTA_PREVIEW_CHARS = 400;

export function ActiveAgentPanel({
  agent,
  focused = false,
  colorMode = 'color',
}: ActiveAgentPanelProps) {
  const useColor = colorMode === 'color';
  const preview =
    agent.lastDelta.length > MAX_DELTA_PREVIEW_CHARS
      ? `…${agent.lastDelta.slice(agent.lastDelta.length - MAX_DELTA_PREVIEW_CHARS)}`
      : agent.lastDelta;

  return (
    <Panel title="Active Agent" focused={focused} colorMode={colorMode}>
      <Text>{`agent: ${agent.activeAgentId ?? '—'}`}</Text>
      <Text dimColor={useColor}>
        {`${agent.decisions.length.toString()} decision(s) · ${agent.lastDelta.length.toString()} delta chars`}
      </Text>
      <Text>{preview || '(no output yet)'}</Text>
      {agent.error ? (
        <Text {...(useColor ? { color: 'red' } : {})}>{`error: ${agent.error}`}</Text>
      ) : null}
    </Panel>
  );
}
