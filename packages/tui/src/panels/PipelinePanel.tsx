import { Text } from 'ink';

import type {
  TuiColorMode,
  TuiPipelineState,
  TuiSprintState,
} from '../state/store.js';

import { Panel } from './Panel.js';

export interface PipelinePanelProps {
  readonly pipeline: TuiPipelineState;
  readonly sprints: readonly TuiSprintState[];
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

export function PipelinePanel({
  pipeline,
  sprints,
  focused = false,
  colorMode = 'color',
}: PipelinePanelProps) {
  const stageLabel = pipeline.stage ?? '—';
  const sprintLabel =
    pipeline.sprintIdx !== null
      ? `sprint ${pipeline.sprintIdx.toString()}`
      : 'no sprint';
  return (
    <Panel title="Pipeline" focused={focused} colorMode={colorMode}>
      <Text>
        {`status: ${pipeline.status}`}
      </Text>
      <Text>
        {`stage: ${stageLabel}`}
      </Text>
      <Text>
        {`${sprintLabel} · retries: ${pipeline.retryCount.toString()}`}
      </Text>
      <Text dimColor={colorMode === 'color'}>
        {`${sprints.length.toString()} sprint(s) tracked`}
      </Text>
    </Panel>
  );
}
