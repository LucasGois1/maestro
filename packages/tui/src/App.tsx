import { Box } from 'ink';
import { useEffect, useMemo } from 'react';
import type { EventBus } from '@maestro/core';

import { Footer, deriveFooterState } from './components/Footer.js';
import { Header } from './components/Header.js';
import {
  OverlayHost,
  OverlayHostProvider,
  useOverlayHost,
} from './components/OverlayHost.js';
import {
  KeybindingProvider,
  useKeybinding,
  type KeybindingRouter,
} from './keybindings/index.js';
import { LayoutGrid } from './layout/LayoutGrid.js';
import {
  TerminalSizeProvider,
  useTerminalSize,
  type TerminalSize,
} from './layout/useTerminalSize.js';
import { ActiveAgentPanel } from './panels/ActiveAgentPanel.js';
import { DiffPreviewPanel } from './panels/DiffPreviewPanel.js';
import { nextPanelId, previousPanelId } from './panels/PanelId.js';
import { PipelinePanel } from './panels/PipelinePanel.js';
import { SensorsPanel } from './panels/SensorsPanel.js';
import { SprintsPanel } from './panels/SprintsPanel.js';
import { bridgeBusToStore } from './state/eventBridge.js';
import {
  createTuiStore,
  type TuiColorMode,
  type TuiStore,
} from './state/store.js';
import { useStoreSelector } from './state/useStoreSelector.js';

export interface AppProps {
  readonly store?: TuiStore;
  readonly bus?: EventBus;
  readonly colorMode?: TuiColorMode;
  readonly terminalSize?: TerminalSize;
  readonly keybindingRouter?: KeybindingRouter;
  readonly initialOverlay?: {
    readonly id: string;
    readonly title: string;
    readonly render: () => React.ReactNode;
  };
}

export function App({
  store,
  bus,
  colorMode,
  terminalSize,
  keybindingRouter,
  initialOverlay,
}: AppProps) {
  const activeStore = useMemo(
    () => store ?? createTuiStore({ colorMode: colorMode ?? 'color' }),
    [store, colorMode],
  );

  useEffect(() => {
    if (colorMode) {
      activeStore.setState((state) => ({ ...state, colorMode }));
    }
  }, [activeStore, colorMode]);

  useEffect(() => {
    if (!bus) {
      return;
    }
    const dispose = bridgeBusToStore(bus, activeStore);
    return dispose;
  }, [activeStore, bus]);

  const bodyProps = {
    store: activeStore,
    ...(keybindingRouter ? { keybindingRouter } : {}),
  };
  const content = (
    <OverlayHostProvider
      initialStack={initialOverlay ? [initialOverlay] : []}
    >
      <AppBody {...bodyProps} />
    </OverlayHostProvider>
  );

  if (terminalSize) {
    return <TerminalSizeProvider value={terminalSize}>{content}</TerminalSizeProvider>;
  }
  return content;
}

interface AppBodyProps {
  readonly store: TuiStore;
  readonly keybindingRouter?: KeybindingRouter;
}

function AppBody({ store, keybindingRouter }: AppBodyProps) {
  const overlayHost = useOverlayHost();
  const focus = useStoreSelector(store, (state) => state.focus);
  const providerProps = {
    focusedPanelId: focus.panelId,
    overlayOpen: overlayHost.overlays.length > 0,
    ...(keybindingRouter ? { router: keybindingRouter } : {}),
  };
  return (
    <KeybindingProvider {...providerProps}>
      <AppShell store={store} />
    </KeybindingProvider>
  );
}

function AppShell({ store }: { readonly store: TuiStore }) {
  const overlayHost = useOverlayHost();
  const mode = useStoreSelector(store, (state) => state.mode);
  const header = useStoreSelector(store, (state) => state.header);
  const pipeline = useStoreSelector(store, (state) => state.pipeline);
  const sprints = useStoreSelector(store, (state) => state.sprints);
  const agent = useStoreSelector(store, (state) => state.agent);
  const sensors = useStoreSelector(store, (state) => state.sensors);
  const diffPreview = useStoreSelector(store, (state) => state.diffPreview);
  const focus = useStoreSelector(store, (state) => state.focus);
  const colorMode = useStoreSelector(store, (state) => state.colorMode);
  const size = useTerminalSize();
  const footerState = deriveFooterState(
    pipeline.status,
    overlayHost.overlays.length > 0,
  );

  useKeybinding({ kind: 'global' }, { key: 'tab' }, () => {
    store.setState((state) => ({
      ...state,
      focus: { ...state.focus, panelId: nextPanelId(state.focus.panelId) },
    }));
  });

  useKeybinding({ kind: 'global' }, { key: 'tab', shift: true }, () => {
    store.setState((state) => ({
      ...state,
      focus: {
        ...state.focus,
        panelId: previousPanelId(state.focus.panelId),
      },
    }));
  });

  useKeybinding({ kind: 'overlay' }, { key: 'escape' }, () => {
    overlayHost.pop();
  });

  return (
    <Box flexDirection="column" width={size.columns}>
      <Header mode={mode} header={header} colorMode={colorMode} />
      <LayoutGrid
        focusedPanelId={focus.panelId}
        slots={{
          pipeline: (
            <PipelinePanel
              pipeline={pipeline}
              sprints={sprints}
              focused={focus.panelId === 'pipeline'}
              colorMode={colorMode}
            />
          ),
          activeAgent: (
            <ActiveAgentPanel
              agent={agent}
              focused={focus.panelId === 'activeAgent'}
              colorMode={colorMode}
            />
          ),
          sprints: (
            <SprintsPanel
              sprints={sprints}
              focused={focus.panelId === 'sprints'}
              colorMode={colorMode}
            />
          ),
          sensors: (
            <SensorsPanel
              sensors={sensors}
              focused={focus.panelId === 'sensors'}
              colorMode={colorMode}
            />
          ),
          diff: (
            <DiffPreviewPanel
              diffPreview={diffPreview}
              focused={focus.panelId === 'diff'}
              colorMode={colorMode}
            />
          ),
        }}
      />
      <OverlayHost colorMode={colorMode} />
      <Footer state={footerState} colorMode={colorMode} />
    </Box>
  );
}
