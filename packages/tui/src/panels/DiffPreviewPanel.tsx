import { Text } from 'ink';

import type { TuiColorMode, TuiDiffPreviewState } from '../state/store.js';

import { Panel } from './Panel.js';

export interface DiffPreviewPanelProps {
  readonly diffPreview: TuiDiffPreviewState;
  readonly focused?: boolean;
  readonly colorMode?: TuiColorMode;
}

const MODE_DESCRIPTIONS: Readonly<Record<TuiDiffPreviewState['mode'], string>> = {
  diff: 'unified diff for the current sprint',
  preview: 'formatted preview of the artifact',
  feedback: 'reviewer feedback timeline',
};

export function DiffPreviewPanel({
  diffPreview,
  focused = false,
  colorMode = 'color',
}: DiffPreviewPanelProps) {
  const useColor = colorMode === 'color';
  return (
    <Panel
      title={`Diff · Preview · Feedback (${diffPreview.mode})`}
      focused={focused}
      colorMode={colorMode}
      footerHint="coming soon — DSFT-88"
    >
      <Text dimColor={useColor}>{MODE_DESCRIPTIONS[diffPreview.mode]}</Text>
    </Panel>
  );
}
