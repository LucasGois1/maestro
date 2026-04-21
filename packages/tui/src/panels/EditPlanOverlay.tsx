import { Box, Text } from 'ink';

import type { TuiColorMode } from '../state/store.js';

export const EDIT_PLAN_OVERLAY_ID = 'editPlan';

export interface EditPlanOverlayProps {
  readonly title?: string;
  readonly body: string;
  readonly colorMode?: TuiColorMode;
}

export function EditPlanOverlay({
  title = 'Editar plano (contrato)',
  body,
  colorMode = 'color',
}: EditPlanOverlayProps) {
  const useColor = colorMode === 'color';
  return (
    <Box flexDirection="column">
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        {title}
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        {body}
      </Text>
    </Box>
  );
}

export function createEditPlanMessageOverlay(
  body: string,
  colorMode: TuiColorMode,
) {
  return {
    id: EDIT_PLAN_OVERLAY_ID,
    title: 'Editar plano',
    render: () => <EditPlanOverlay body={body} colorMode={colorMode} />,
  };
}
