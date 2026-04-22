import { Box, Text } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { useKeybinding } from '../keybindings/useKeybinding.js';
import { useTerminalSize } from '../layout/useTerminalSize.js';
import type { TuiColorMode } from '../state/store.js';

export const KB_EXPLORER_OVERLAY_ID = 'kbExplorer';

export interface KbExplorerFileEntry {
  readonly path: string;
  readonly previewText: string;
}

export interface KbExplorerOverlayProps {
  readonly repoLabel: string;
  readonly files: readonly KbExplorerFileEntry[];
  readonly kbPathsRead: ReadonlySet<string> | readonly string[];
  readonly colorMode?: TuiColorMode;
}

function asSet(paths: ReadonlySet<string> | readonly string[]): Set<string> {
  return paths instanceof Set ? paths : new Set(paths);
}

export function KbExplorerOverlay({
  repoLabel,
  files,
  kbPathsRead,
  colorMode = 'color',
}: KbExplorerOverlayProps) {
  const useColor = colorMode === 'color';
  const readSet = useMemo(() => asSet(kbPathsRead), [kbPathsRead]);
  const size = useTerminalSize();
  const viewport = Math.max(4, Math.min(28, size.rows - 12));

  const sorted = useMemo(
    () => [...files].sort((a, b) => a.path.localeCompare(b.path)),
    [files],
  );

  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(
    Math.max(0, index),
    Math.max(0, sorted.length - 1),
  );

  const bump = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const max = Math.max(0, sorted.length - 1);
        return Math.max(0, Math.min(max, i + delta));
      });
    },
    [sorted.length],
  );

  useKeybinding({ kind: 'overlay' }, { key: 'up' }, () => {
    bump(-1);
  });
  useKeybinding({ kind: 'overlay' }, { key: 'down' }, () => {
    bump(1);
  });
  useKeybinding({ kind: 'overlay' }, { key: 'k' }, () => {
    bump(-1);
  });
  useKeybinding({ kind: 'overlay' }, { key: 'j' }, () => {
    bump(1);
  });

  if (sorted.length === 0) {
    return (
      <Text dimColor={useColor}>
        (nenhum ficheiro sob .maestro/ — corre o CLI a partir do repo)
      </Text>
    );
  }

  const active = sorted[safeIndex];
  const windowStart = Math.max(
    0,
    Math.min(safeIndex, Math.max(0, sorted.length - viewport)),
  );
  const slice = sorted.slice(windowStart, windowStart + viewport);

  return (
    <Box flexDirection="column">
      <Text dimColor={useColor} wrap="wrap">
        {`repo: ${repoLabel} · ${sorted.length.toString()} ficheiros · [↑↓][j][k] linha`}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {slice.map((f, i) => {
          const rowIdx = windowStart + i;
          const isActive = rowIdx === safeIndex;
          const touched = readSet.has(f.path);
          const prefix = isActive ? '▸ ' : '  ';
          const label = `${prefix}${f.path}${touched ? ' · lido' : ''}`;
          const props =
            useColor && touched
              ? { color: 'green' as const, bold: isActive }
              : isActive
                ? { bold: true as const }
                : {};
          return (
            <Text key={f.path} {...props} dimColor={!touched && useColor}>
              {label}
            </Text>
          );
        })}
      </Box>
      {active ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold dimColor={useColor}>
            preview
          </Text>
          <Text dimColor={useColor} wrap="wrap">
            {active.previewText.length > 2000
              ? `${active.previewText.slice(0, 2000)}…`
              : active.previewText}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

export function createKbExplorerOverlay(
  repoLabel: string,
  files: readonly KbExplorerFileEntry[],
  kbPathsRead: ReadonlySet<string> | readonly string[],
  colorMode: TuiColorMode,
) {
  return {
    id: KB_EXPLORER_OVERLAY_ID,
    title: 'KB — explorador .maestro',
    render: () => (
      <KbExplorerOverlay
        repoLabel={repoLabel}
        files={files}
        kbPathsRead={kbPathsRead}
        colorMode={colorMode}
      />
    ),
  };
}
