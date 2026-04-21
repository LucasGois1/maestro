import { Box, Text } from 'ink';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  /** Row selection for detail overlay; managed by parent store. */
  readonly focusedSensorId: string | null;
  readonly onFocusedSensorIdChange: (sensorId: string | null) => void;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
  readonly maxVisibleLines?: number;
}

const DEFAULT_VISIBLE = 10;

export function SensorsPanel({
  sensors,
  focusedSensorId,
  onFocusedSensorIdChange,
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

  useEffect(() => {
    if (entries.length === 0) {
      if (focusedSensorId !== null) {
        onFocusedSensorIdChange(null);
      }
      return;
    }
    if (focusedSensorId === null || !sensors[focusedSensorId]) {
      onFocusedSensorIdChange(entries[0]?.sensorId ?? null);
    }
  }, [
    entries,
    focusedSensorId,
    onFocusedSensorIdChange,
    sensors,
  ]);

  const selectedIndex = useMemo(() => {
    const i = entries.findIndex((e) => e.sensorId === focusedSensorId);
    return i >= 0 ? i : 0;
  }, [entries, focusedSensorId]);

  useEffect(() => {
    if (entries.length === 0) {
      return;
    }
    setScrollTop((prev) => {
      if (selectedIndex < prev) {
        return selectedIndex;
      }
      if (selectedIndex >= prev + maxVisibleLines) {
        return selectedIndex - maxVisibleLines + 1;
      }
      return prev;
    });
  }, [entries.length, maxVisibleLines, selectedIndex]);

  const maxScroll = Math.max(0, entries.length - maxVisibleLines);
  const effectiveScroll = Math.min(scrollTop, maxScroll);
  const visible = entries.slice(effectiveScroll, effectiveScroll + maxVisibleLines);

  const moveFocus = useCallback(
    (delta: number) => {
      if (entries.length === 0) {
        return;
      }
      const cur = entries.findIndex((e) => e.sensorId === focusedSensorId);
      const base = cur >= 0 ? cur : 0;
      const next = Math.max(0, Math.min(entries.length - 1, base + delta));
      onFocusedSensorIdChange(entries[next]?.sensorId ?? null);
    },
    [entries, focusedSensorId, onFocusedSensorIdChange],
  );

  useKeybinding(
    { kind: 'panel', panelId: 'sensors' },
    { key: 'down' },
    () => {
      moveFocus(1);
    },
  );
  useKeybinding(
    { kind: 'panel', panelId: 'sensors' },
    { key: 'up' },
    () => {
      moveFocus(-1);
    },
  );
  useKeybinding(
    { kind: 'panel', panelId: 'sensors' },
    { key: 'j' },
    () => {
      moveFocus(1);
    },
  );
  useKeybinding(
    { kind: 'panel', panelId: 'sensors' },
    { key: 'k' },
    () => {
      moveFocus(-1);
    },
  );

  if (entries.length === 0) {
    return (
      <Panel title="Sensores (paralelo)" focused={focused} colorMode={colorMode}>
        <Text dimColor={useColor}>no sensors reporting</Text>
      </Panel>
    );
  }

  const sensorsFooter = focused
    ? 'detalhe [s] · linha [↑↓][j][k]'
    : undefined;

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
          const isRowFocus = sensor.sensorId === focusedSensorId;
          const colorProps =
            useColor && blockFail
              ? { color: 'red' as const, bold: true as const }
              : useColor && warnOnly
                ? { color: 'yellow' as const }
                : useColor && sensor.status === 'running'
                  ? { color: 'cyan' as const }
                  : {};
          const prefix = isRowFocus && focused ? '▸ ' : '  ';
          return (
            <Text key={sensor.sensorId} {...colorProps}>
              {`${prefix}${row}`}
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
