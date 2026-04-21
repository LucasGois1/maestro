export const TUI_PACKAGE_NAME = '@maestro/tui';

export { HelloWorld } from './components/HelloWorld.js';
export { formatHelloMessage } from './message.js';

export { App } from './App.js';

export {
  computeStageDurations,
  computeStageStatuses,
  createInitialTuiState,
  createTuiStore,
  DEFAULT_AGENT_DECISION_BUFFER,
  DEFAULT_AGENT_LOG_BUFFER,
  DEFAULT_DIFF_VIEWPORT_LINES,
  DEFAULT_FEEDBACK_HISTORY_CAP,
  PANEL_FOCUS_ORDER,
  PIPELINE_STAGE_ORDER,
  selectStageDurations,
  selectStageStatuses,
  type TuiAgentDecision,
  type TuiAgentLogEntry,
  type TuiAgentLogKind,
  type TuiAgentState,
  type TuiColorMode,
  type TuiDiscoveryPhase,
  type TuiDiscoveryState,
  type TuiDiffPreviewState,
  type TuiFeedbackEntry,
  type TuiFocusState,
  type TuiHeaderState,
  type TuiMode,
  type TuiPanelId,
  type TuiPipelineState,
  type TuiPipelineStatus,
  type TuiSensorState,
  type TuiSensorStatus,
  type TuiSprintState,
  type TuiStageDurationMap,
  type TuiStageRecord,
  type TuiStageStatus,
  type TuiStageStatusMap,
  type TuiState,
  type TuiStateUpdater,
  type TuiStore,
} from './state/store.js';
export { useStoreSelector } from './state/useStoreSelector.js';
export { bridgeBusToStore } from './state/eventBridge.js';

export { resolveColorMode } from './layout/color.js';
export {
  isNarrowTerminal,
  TerminalSizeProvider,
  useTerminalSize,
  type TerminalSize,
} from './layout/useTerminalSize.js';
export { LayoutGrid } from './layout/LayoutGrid.js';

export { Header } from './components/Header.js';
export { Footer, deriveFooterState } from './components/Footer.js';
export {
  ListPickerScreen,
  type ListPickerItem,
} from './components/ListPickerScreen.js';
export {
  OverlayHost,
  OverlayHostProvider,
  useOverlayHost,
} from './components/OverlayHost.js';

export { Panel } from './panels/Panel.js';
export {
  PANEL_TITLES,
  nextPanelId,
  previousPanelId,
} from './panels/PanelId.js';
export { PipelinePanel } from './panels/PipelinePanel.js';
export { ActiveAgentPanel } from './panels/ActiveAgentPanel.js';
export { SprintsPanel } from './panels/SprintsPanel.js';
export { SensorsPanel } from './panels/SensorsPanel.js';
export { DiscoveryScreen } from './panels/DiscoveryScreen.js';
export { DiffPreviewPanel } from './panels/DiffPreviewPanel.js';
export {
  AGENT_LOG_OVERLAY_ID,
  AgentLogOverlay,
  createAgentLogOverlay,
} from './panels/AgentLogOverlay.js';
export {
  FEEDBACK_HISTORY_OVERLAY_ID,
  FeedbackHistoryOverlay,
  createFeedbackHistoryOverlay,
} from './panels/FeedbackHistoryOverlay.js';
export {
  SENSORS_DETAIL_OVERLAY_ID,
  SensorsDetailOverlay,
  createSensorsDetailOverlay,
} from './panels/SensorsDetailOverlay.js';
export { diffLineInkProps, sliceDiffWindow } from './panels/diffLineStyle.js';
export {
  SPRINT_ICONS,
  STAGE_ICONS,
  stageLabel,
  type StageIcon,
  type SprintListStatus,
} from './panels/stageIcons.js';
export { formatDurationMs } from './panels/formatDuration.js';

export {
  createKeybindingRouter,
  KeybindingProvider,
  normalizeMatch,
  useKeybinding,
  useKeybindingContext,
  type KeybindingContext,
  type KeybindingContextValue,
  type KeybindingDescriptor,
  type KeybindingMatch,
  type KeybindingProviderProps,
  type KeybindingRegistration,
  type KeybindingRouter,
  type KeybindingScope,
  type UseKeybindingOptions,
} from './keybindings/index.js';

export {
  createDebouncedStore,
  createFrameThrottle,
  useRenderDebounce,
} from './hooks/useRenderDebounce.js';

export { DEMO_SCRIPT, playDemoEvents } from './fixtures/demo-events.js';
