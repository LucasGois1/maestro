import { Box, Text } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { useKeybinding } from '../keybindings/index.js';
import type { TuiColorMode, TuiSensorState } from '../state/store.js';

import { Panel } from './Panel.js';
import {
  formatSensorRow,
  sensorRowIsBlockFailure,
  summarizeSensors,
} from './sensorRowStyle.js';

export interface SensorsPanelProps {
  readonly sensors: Readonly<Record<string, TuiSensorState>>;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
  readonly maxVisibleLines?: number;
}

const DEFAULT_VISIBLE = 10;

export function SensorsPanel({
  sensors,
  focused = false,
  colorMode = 'color',
  maxVisibleLines = DEFAULT_VISIBLE,
}: SensorsPanelProps) {
  const useColor = colorMode === 'color';
  const entries = useMemo(
    () =>
      Object.values(sensors).sort((a, b) =>
        a.sensorId.localeCompare(b.sensorId),
      ),
    [sensors],
  );

  const summary = useMemo(() => summarizeSensors(sensors), [sensors]);

  const [scrollTop, setScrollTop] = useState(0);

  const maxScroll = Math.max(0, entries.length - maxVisibleLines);
  const effectiveScroll = Math.min(scrollTop, maxScroll);
  const visible = entries.slice(effectiveScroll, effectiveScroll + maxVisibleLines);

  const scrollDown = useCallback(() => {
    setScrollTop((s) => Math.min(s + 1, maxScroll));
  }, [maxScroll]);

  const scrollUp = useCallback(() => {
    setScrollTop((s) => Math.max(0, s - 1));
  }, []);

  useKeybinding({ kind: 'panel', panelId: 'sensors' }, { key: 'j' }, scrollDown);
  useKeybinding({ kind: 'panel', panelId: 'sensors' }, { key: 'k' }, scrollUp);

  if (entries.length === 0) {
    return (
      <Panel title="Sensores (paralelo)" focused={focused} colorMode={colorMode}>
        <Text dimColor={useColor}>no sensors reporting</Text>
      </Panel>
    );
  }

  const sensorsFooter = focused ? 'detalhe [s] · scroll [j][k]' : undefined;

  return (
    <Panel
      title="Sensores (paralelo)"
      focused={focused}
      colorMode={colorMode}
      {...(sensorsFooter !== undefined ? { footerHint: sensorsFooter } : {})}
    >
      <Box flexDirection="column">
        {visible.map((sensor) => {
          const row = formatSensorRow(sensor, 36);
          const blockFail = sensorRowIsBlockFailure(sensor);
          const warnOnly =
            sensor.onFail === 'warn' &&
            (sensor.status === 'failed' || sensor.status === 'warned');
          const colorProps =
            useColor && blockFail
              ? { color: 'red' as const, bold: true as const }
              : useColor && warnOnly
                ? { color: 'yellow' as const }
                : useColor && sensor.status === 'running'
                  ? { color: 'cyan' as const }
                  : {};
          return (
            <Text key={sensor.sensorId} {...colorProps}>
              {row}
            </Text>
          );
        })}
        <Text dimColor={useColor}>
          {`${summary.passed.toString()} passed · ${summary.running.toString()} running · ${summary.queued.toString()} queued · ${summary.failed.toString()} failed`}
        </Text>
      </Box>
    </Panel>
  );
}
