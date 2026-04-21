import { Box, Text } from 'ink';

import type { PipelineStageName } from '@maestro/core';

import {
  computeStageDurations,
  computeStageStatuses,
  PIPELINE_STAGE_ORDER,
  type TuiColorMode,
  type TuiPipelineState,
  type TuiSprintState,
} from '../state/store.js';

import { formatDurationMs } from './formatDuration.js';
import { Panel } from './Panel.js';
import { STAGE_ICONS, stageLabel } from './stageIcons.js';

export interface PipelinePanelProps {
  readonly pipeline: TuiPipelineState;
  readonly sprints: readonly TuiSprintState[];
  readonly stageOrder?: readonly PipelineStageName[];
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

export function PipelinePanel({
  pipeline,
  sprints,
  stageOrder = PIPELINE_STAGE_ORDER,
  focused = false,
  colorMode = 'color',
}: PipelinePanelProps) {
  const useColor = colorMode === 'color';
  const statuses = computeStageStatuses(pipeline, sprints);
  const durations = computeStageDurations(pipeline);

  return (
    <Panel title="Pipeline" focused={focused} colorMode={colorMode}>
      {stageOrder.map((stage) => {
        const status = statuses[stage];
        const icon = STAGE_ICONS[status];
        const isCurrent = pipeline.stage === stage;
        const duration = durations[stage];
        const durationText =
          status === 'pending'
            ? '—'
            : status === 'running'
              ? '…'
              : formatDurationMs(duration);
        const textProps = {
          ...(useColor && icon.color ? { color: icon.color } : {}),
          ...(isCurrent || icon.bold ? { bold: true } : {}),
        };
        return (
          <Text key={stage} {...textProps}>
            {`${icon.icon} ${stageLabel(stage).padEnd(12)} ${durationText}`}
          </Text>
        );
      })}
      <Text dimColor={useColor}>
        {`status: ${pipeline.status}${
          pipeline.sprintIdx !== null
            ? ` · sprint #${pipeline.sprintIdx.toString()}`
            : ''
        }${
          pipeline.retryCount > 0
            ? ` · retries ${pipeline.retryCount.toString()}`
            : ''
        }`}
      </Text>
      {pipeline.error ? (
        <Box>
          <Text {...(useColor ? { color: 'red' } : {})}>
            {`error: ${pipeline.error}`}
          </Text>
        </Box>
      ) : null}
    </Panel>
  );
}
