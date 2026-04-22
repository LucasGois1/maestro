import { Box, Text } from 'ink';

import type { TuiColorMode, TuiSensorState } from '../state/store.js';

import { formatDurationMs } from './formatDuration.js';

export const SENSORS_DETAIL_OVERLAY_ID = 'sensorsDetail';

export interface SensorsDetailOverlayProps {
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
  readonly focusedSensorId: string | null;
  readonly colorMode?: TuiColorMode;
}

export function SensorsDetailOverlay({
  sensors,
  focusedSensorId,
  colorMode = 'color',
}: SensorsDetailOverlayProps) {
  const useColor = colorMode === 'color';
  const entries = Object.values(sensors).sort((a, b) =>
    a.sensorId.localeCompare(b.sensorId),
  );

  if (entries.length === 0) {
    return <Text dimColor={useColor}>(nenhum sensor)</Text>;
  }

  const primaryId =
    focusedSensorId !== null && sensors[focusedSensorId]
      ? focusedSensorId
      : (entries[0]?.sensorId ?? null);
  const primary = primaryId ? sensors[primaryId] : undefined;
  const rest = entries.filter((s) => s.sensorId !== primaryId);

  return (
    <Box flexDirection="column">
      {primary ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold {...(useColor ? { color: 'magenta' } : {})}>
            {`▸ ${primary.sensorId} (foco)`}
          </Text>
          <Text dimColor={useColor}>
            {`kind: ${primary.kind} · status: ${primary.status} · onFail: ${primary.onFail ?? '—'}`}
          </Text>
          <Text dimColor={useColor}>
            {`duration: ${primary.durationMs !== null ? formatDurationMs(primary.durationMs) : '—'}`}
          </Text>
          {primary.message ? (
            <Text dimColor={useColor}>{`last: ${primary.message}`}</Text>
          ) : null}
          {primary.stdout ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold dimColor={useColor}>
                stdout
              </Text>
              <Text dimColor={useColor} wrap="wrap">
                {primary.stdout}
              </Text>
            </Box>
          ) : null}
          {primary.stderr ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold {...(useColor ? { color: 'red' } : {})}>
                stderr
              </Text>
              <Text dimColor={useColor} wrap="wrap">
                {primary.stderr}
              </Text>
            </Box>
          ) : null}
          {primary.violations.length > 0 ? (
            <Box flexDirection="column" marginTop={1}>
              <Text bold dimColor={useColor}>
                violations
              </Text>
              {primary.violations.map((v, i) => (
                <Text key={`${v.file}-${i.toString()}`} dimColor={useColor}>
                  {`${v.file}${v.line !== null ? `:${v.line.toString()}` : ''} — ${v.message}`}
                </Text>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {rest.length > 0 ? (
        <Box flexDirection="column">
          <Text bold dimColor={useColor}>
            Outros
          </Text>
          {rest.map((sensor) => (
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
      ) : null}
    </Box>
  );
}

export function createSensorsDetailOverlay(
  sensors: Readonly<Record<string, TuiSensorState>>,
  colorMode: TuiColorMode,
  focusedSensorId: string | null,
) {
  return {
    id: SENSORS_DETAIL_OVERLAY_ID,
    title: 'Sensores — detalhe',
    render: () => (
      <SensorsDetailOverlay
        sensors={sensors}
        focusedSensorId={focusedSensorId}
        colorMode={colorMode}
      />
    ),
  };
}
