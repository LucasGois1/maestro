import { Box, Text } from 'ink';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useKeybinding } from '../keybindings/index.js';
import {
  DEFAULT_DIFF_VIEWPORT_LINES,
  type TuiColorMode,
  type TuiDiffPreviewState,
} from '../state/store.js';

import { diffLineInkProps, sliceDiffWindow } from './diffLineStyle.js';
import { Panel } from './Panel.js';

export interface DiffPreviewPanelProps {
  readonly diffPreview: TuiDiffPreviewState;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
  readonly viewportLines?: number;
}

const PREVIEW_V01 =
  'Preview da aplicação (Playwright) disponível no v0.3 — behaviour harness.';

interface DiffUnifiedBodyProps {
  readonly activePath: string | null;
  readonly unifiedDiff: string;
  readonly viewportLines: number;
  readonly useColor: boolean;
}

function DiffUnifiedBody({
  activePath,
  unifiedDiff,
  viewportLines,
  useColor,
}: DiffUnifiedBodyProps) {
  const [scroll, setScroll] = useState(0);
  const { lines, totalLines } = useMemo(
    () => sliceDiffWindow(unifiedDiff, scroll, viewportLines),
    [unifiedDiff, scroll, viewportLines],
  );
  const maxScroll = Math.max(0, totalLines - viewportLines);
  const scrollDown = useCallback(() => {
    setScroll((s) => Math.min(s + 1, maxScroll));
  }, [maxScroll]);
  const scrollUp = useCallback(() => {
    setScroll((s) => Math.max(0, s - 1));
  }, []);

  useKeybinding({ kind: 'panel', panelId: 'diff' }, { key: 'j' }, scrollDown);
  useKeybinding({ kind: 'panel', panelId: 'diff' }, { key: 'k' }, scrollUp);

  const pathLine = activePath !== null ? activePath : '(nenhum arquivo ativo)';

  return (
    <Box flexDirection="column">
      <Text bold={useColor}>{pathLine}</Text>
      <Text dimColor={useColor}>─────────────────────────────</Text>
      {lines.map((line, index) => {
        const key = `${scroll.toString()}-${index.toString()}-${line.slice(0, 12)}`;
        const ink = diffLineInkProps(line, useColor);
        return (
          <Text key={key} {...ink}>
            {line.length > 200 ? `${line.slice(0, 200)}…` : line}
          </Text>
        );
      })}
      {totalLines > viewportLines ? (
        <Text dimColor={useColor}>
          {`… ${(scroll + 1).toString()}-${Math.min(scroll + lines.length, totalLines).toString()} / ${totalLines.toString()} linhas · [j][k]`}
        </Text>
      ) : null}
    </Box>
  );
}

export function DiffPreviewPanel({
  diffPreview,
  focused = false,
  colorMode = 'color',
  viewportLines = DEFAULT_DIFF_VIEWPORT_LINES,
}: DiffPreviewPanelProps) {
  const useColor = colorMode === 'color';
  const title = `Diff · Preview · Feedback (${diffPreview.mode})`;

  let body: ReactNode;
  if (diffPreview.mode === 'preview') {
    body = <Text dimColor={useColor}>{PREVIEW_V01}</Text>;
  } else if (diffPreview.mode === 'feedback' && diffPreview.feedback !== null) {
    const fb = diffPreview.feedback;
    const loc =
      fb.file !== null
        ? `${fb.file}${fb.line !== null ? `:${fb.line.toString()}` : ''}`
        : '—';
    body = (
      <Box flexDirection="column">
        <Text dimColor={useColor}>
          {fb.sprintIdx !== null
            ? `sprint ${fb.sprintIdx.toString()} · tent. ${fb.attempt.toString()}`
            : `tent. ${fb.attempt.toString()}`}
        </Text>
        <Text {...(useColor ? { color: 'yellow' as const } : {})}>
          {`★ ${fb.criterion}`}
        </Text>
        <Text dimColor={useColor}>{fb.failure}</Text>
        <Text dimColor={useColor}>{`↪ ${loc}`}</Text>
        {fb.suggestedAction ? (
          <Text
            dimColor={useColor}
          >{`ação sugerida: ${fb.suggestedAction}`}</Text>
        ) : null}
      </Box>
    );
  } else if (diffPreview.mode === 'feedback') {
    body = (
      <Text dimColor={useColor}>
        (sem feedback — aguarde evaluator.feedback)
      </Text>
    );
  } else if (diffPreview.unifiedDiff.length === 0) {
    body = <Text dimColor={useColor}>(aguardando diff…)</Text>;
  } else {
    body = (
      <DiffUnifiedBody
        key={diffPreview.activePath ?? '__none__'}
        activePath={diffPreview.activePath}
        unifiedDiff={diffPreview.unifiedDiff}
        viewportLines={viewportLines}
        useColor={useColor}
      />
    );
  }

  const panelFooter = focused
    ? 'próximo arquivo [d] · preview [p] · histórico feedback [r] · scroll [j][k]'
    : undefined;

  return (
    <Panel
      title={title}
      focused={focused}
      colorMode={colorMode}
      {...(panelFooter !== undefined ? { footerHint: panelFooter } : {})}
    >
      {body}
    </Panel>
  );
}
