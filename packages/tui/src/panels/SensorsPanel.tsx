import { Box, Text } from 'ink';

import type { TuiColorMode, TuiSensorState } from '../state/store.js';

import { Panel } from './Panel.js';

export interface SensorsPanelProps {
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

const STATUS_COLOR: Readonly<Record<TuiSensorState['status'], string>> = {
  running: 'yellow',
  passed: 'green',
  warned: 'yellow',
  failed: 'red',
  error: 'red',
  timeout: 'red',
  skipped: 'gray',
};

export function SensorsPanel({
  sensors,
  focused = false,
  colorMode = 'color',
}: SensorsPanelProps) {
  const useColor = colorMode === 'color';
  const entries = Object.values(sensors).sort((a, b) =>
    a.sensorId.localeCompare(b.sensorId),
  );

  if (entries.length === 0) {
    return (
      <Panel title="Sensors" focused={focused} colorMode={colorMode}>
        <Text dimColor={useColor}>no sensors reporting</Text>
      </Panel>
    );
  }

  return (
    <Panel title="Sensors" focused={focused} colorMode={colorMode}>
      <Box flexDirection="column">
        {entries.map((sensor) => (
          <Text key={sensor.sensorId}>
            <Text {...(useColor ? { color: STATUS_COLOR[sensor.status] } : {})}>
              {`● `}
            </Text>
            {`${sensor.sensorId.padEnd(12, ' ')} ${sensor.status}${sensor.message ? ` · ${sensor.message}` : ''}`}
          </Text>
        ))}
      </Box>
    </Panel>
  );
}
