import { Box, Text } from 'ink';

import type { TuiColorMode, TuiSensorState } from '../state/store.js';

import { formatDurationMs } from './formatDuration.js';

export const SENSORS_DETAIL_OVERLAY_ID = 'sensorsDetail';

export interface SensorsDetailOverlayProps {
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
  readonly colorMode?: TuiColorMode;
}

export function SensorsDetailOverlay({
  sensors,
  colorMode = 'color',
}: SensorsDetailOverlayProps) {
  const useColor = colorMode === 'color';
  const entries = Object.values(sensors).sort((a, b) =>
    a.sensorId.localeCompare(b.sensorId),
  );

  if (entries.length === 0) {
    return <Text dimColor={useColor}>(nenhum sensor)</Text>;
  }

  return (
    <Box flexDirection="column">
      {entries.map((sensor) => (
        <Box key={sensor.sensorId} flexDirection="column" marginBottom={1}>
          <Text bold>{sensor.sensorId}</Text>
          <Text dimColor={useColor}>
            {`kind: ${sensor.kind} · status: ${sensor.status} · onFail: ${sensor.onFail ?? '—'}`}
          </Text>
          <Text dimColor={useColor}>
            {`duration: ${sensor.durationMs !== null ? formatDurationMs(sensor.durationMs) : '—'}`}
          </Text>
          {sensor.message ? (
            <Text dimColor={useColor}>{`message: ${sensor.message}`}</Text>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export function createSensorsDetailOverlay(
  sensors: Readonly<Record<string, TuiSensorState>>,
  colorMode: TuiColorMode,
) {
  return {
    id: SENSORS_DETAIL_OVERLAY_ID,
    title: 'Sensores — detalhe',
    render: () => (
      <SensorsDetailOverlay sensors={sensors} colorMode={colorMode} />
    ),
  };
}
