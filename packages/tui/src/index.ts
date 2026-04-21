export const TUI_PACKAGE_NAME = '@maestro/tui';

export { HelloWorld } from './components/HelloWorld.js';
export { formatHelloMessage } from './message.js';

export { App } from './App.js';

export {
  createInitialTuiState,
  createTuiStore,
  DEFAULT_AGENT_DECISION_BUFFER,
  PANEL_FOCUS_ORDER,
  type TuiAgentDecision,
  type TuiAgentState,
  type TuiColorMode,
  type TuiDiffPreviewState,
  type TuiFocusState,
  type TuiHeaderState,
  type TuiMode,
  type TuiPanelId,
  type TuiPipelineState,
  type TuiPipelineStatus,
  type TuiSensorState,
  type TuiSensorStatus,
  type TuiSprintState,
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
