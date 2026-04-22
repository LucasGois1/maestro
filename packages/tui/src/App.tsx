import { Box } from 'ink';
import { useCallback, useEffect, useMemo } from 'react';
import type { EventBus } from '@maestro/core';

import {
  CommandInput,
  type TuiCommandExecutor,
} from './components/CommandInput.js';
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
  useKeybindingContext,
  type KeybindingRouter,
} from './keybindings/index.js';
import { LayoutGrid } from './layout/LayoutGrid.js';
import {
  TerminalSizeProvider,
  useTerminalSize,
  type TerminalSize,
} from './layout/useTerminalSize.js';
import { ActiveAgentPanel } from './panels/ActiveAgentPanel.js';
import {
  AGENT_LOG_OVERLAY_ID,
  createAgentLogOverlay,
} from './panels/AgentLogOverlay.js';
import { DiscoveryScreen } from './panels/DiscoveryScreen.js';
import { DiffPreviewPanel } from './panels/DiffPreviewPanel.js';
import {
  FEEDBACK_HISTORY_OVERLAY_ID,
  createFeedbackHistoryOverlay,
} from './panels/FeedbackHistoryOverlay.js';
import { HELP_OVERLAY_ID, createHelpOverlay } from './panels/HelpOverlay.js';
import {
  KB_EXPLORER_OVERLAY_ID,
  createKbExplorerOverlay,
  type KbExplorerFileEntry,
} from './panels/KbExplorerOverlay.js';
import {
  EDIT_PLAN_OVERLAY_ID,
  createEditPlanMessageOverlay,
} from './panels/EditPlanOverlay.js';
import {
  SENSORS_DETAIL_OVERLAY_ID,
  createSensorsDetailOverlay,
} from './panels/SensorsDetailOverlay.js';
import { nextPanelId, previousPanelId } from './panels/PanelId.js';
import { PipelinePanel } from './panels/PipelinePanel.js';
import { SensorsPanel } from './panels/SensorsPanel.js';
import { SprintsPanel } from './panels/SprintsPanel.js';
import { bridgeBusToStore } from './state/eventBridge.js';
import {
  createTuiStore,
  type TuiColorMode,
  type TuiState,
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
  readonly discovery?: {
    readonly onChoice: (choice: 'accept' | 'cancel') => void;
  };
  /** When set (e.g. by CLI), `[k]` opens a `.maestro` file list with read highlights. */
  readonly kbExplorer?: {
    readonly repoLabel: string;
    readonly files: readonly KbExplorerFileEntry[];
  };
  /** Resolve sprint contract path and open external editor (CLI unmounts Ink around `onEditPath`). */
  readonly editPlan?: {
    readonly resolveContractPath: (state: TuiState) => string | null;
    readonly onEditPath: (path: string) => void | Promise<void>;
  };
  readonly commandExecutor?: TuiCommandExecutor;
}

export function App({
  store,
  bus,
  colorMode,
  terminalSize,
  keybindingRouter,
  initialOverlay,
  discovery,
  kbExplorer,
  editPlan,
  commandExecutor,
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
    ...(discovery ? { discovery } : {}),
    ...(kbExplorer ? { kbExplorer } : {}),
    ...(editPlan ? { editPlan } : {}),
    ...(commandExecutor ? { commandExecutor } : {}),
  };
  const content = (
    <OverlayHostProvider initialStack={initialOverlay ? [initialOverlay] : []}>
      <AppBody {...bodyProps} />
    </OverlayHostProvider>
  );

  if (terminalSize) {
    return (
      <TerminalSizeProvider value={terminalSize}>
        {content}
      </TerminalSizeProvider>
    );
  }
  return content;
}

interface AppBodyProps {
  readonly store: TuiStore;
  readonly keybindingRouter?: KeybindingRouter;
  readonly discovery?: AppProps['discovery'];
  readonly kbExplorer?: AppProps['kbExplorer'];
  readonly editPlan?: AppProps['editPlan'];
  readonly commandExecutor?: AppProps['commandExecutor'];
}

function AppBody({
  store,
  keybindingRouter,
  discovery,
  kbExplorer,
  editPlan,
  commandExecutor,
}: AppBodyProps) {
  const overlayHost = useOverlayHost();
  const focus = useStoreSelector(store, (state) => state.focus);
  const mode = useStoreSelector(store, (state) => state.mode);
  const providerProps = {
    /** Discovery embeds diff without layout focus; treat diff as focused so panel shortcuts work. */
    focusedPanelId: mode === 'discovery' ? 'diff' : focus.panelId,
    overlayOpen: overlayHost.overlays.length > 0,
    /** Keep router on during discovery; only the stdin command shell disables it. */
    enabled: commandExecutor === undefined,
    ...(keybindingRouter ? { router: keybindingRouter } : {}),
  };
  return (
    <KeybindingProvider {...providerProps}>
      <AppShell
        store={store}
        discovery={discovery}
        kbExplorer={kbExplorer}
        editPlan={editPlan}
        commandExecutor={commandExecutor}
      />
    </KeybindingProvider>
  );
}

function AppShell({
  store,
  discovery,
  kbExplorer,
  editPlan,
  commandExecutor,
}: {
  readonly store: TuiStore;
  readonly discovery?: AppProps['discovery'];
  readonly kbExplorer?: AppProps['kbExplorer'];
  readonly editPlan?: AppProps['editPlan'];
  readonly commandExecutor?: AppProps['commandExecutor'];
}) {
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

  useKeybinding(
    { kind: 'global' },
    { key: 'tab' },
    () => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, panelId: nextPanelId(state.focus.panelId) },
      }));
    },
    { enabled: mode !== 'discovery' },
  );

  useKeybinding(
    { kind: 'global' },
    { key: 'tab', shift: true },
    () => {
      store.setState((state) => ({
        ...state,
        focus: {
          ...state.focus,
          panelId: previousPanelId(state.focus.panelId),
        },
      }));
    },
    { enabled: mode !== 'discovery' },
  );

  useKeybinding({ kind: 'overlay' }, { key: 'escape' }, () => {
    overlayHost.pop();
  });

  useKeybinding({ kind: 'overlay' }, { key: 'q' }, () => {
    overlayHost.pop();
  });

  const openHelp = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === HELP_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    overlayHost.push(createHelpOverlay(colorMode));
  }, [colorMode, overlayHost]);

  useKeybinding({ kind: 'global' }, { key: '?', shift: true }, openHelp);

  const openKbExplorer = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === KB_EXPLORER_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    const label =
      kbExplorer?.repoLabel ?? "placeholder";
    const files = kbExplorer?.files ?? [];
    overlayHost.push(
      createKbExplorerOverlay(
        label,
        files,
        store.getState().kbPathsRead,
        colorMode,
      ),
    );
  }, [colorMode, kbExplorer, overlayHost, store]);

  useKeybinding({ kind: 'global' }, { key: 'k' }, openKbExplorer);

  const openEditPlan = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === EDIT_PLAN_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    if (!editPlan) {
      overlayHost.push(
        createEditPlanMessageOverlay(
          "Missing integration",
          colorMode,
        ),
      );
      return;
    }
    const path = editPlan.resolveContractPath(store.getState());
    if (!path) {
      overlayHost.push(
        createEditPlanMessageOverlay(
          "No one active sprint",
          colorMode,
        ),
      );
      return;
    }
    void (async () => {
      try {
        await editPlan.onEditPath(path);
      } catch (e) {
        overlayHost.push(
          createEditPlanMessageOverlay(
            e instanceof Error ? e.message : String(e),
            colorMode,
          ),
        );
      }
    })();
  }, [colorMode, editPlan, overlayHost, store]);

  useKeybinding({ kind: 'global' }, { key: 'e' }, openEditPlan);

  const selectSprint = useCallback(
    (idx: number) => {
      store.setState((state) => {
        if (!state.sprints.some((sprint) => sprint.idx === idx)) {
          return state;
        }
        return {
          ...state,
          focus: { ...state.focus, selectedSprintIdx: idx },
        };
      });
    },
    [store],
  );

  useSprintDigitKeybindings(selectSprint);

  const openAgentLog = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === AGENT_LOG_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    overlayHost.push(createAgentLogOverlay(store.getState().agent, colorMode));
  }, [colorMode, overlayHost, store]);

  useKeybinding(
    { kind: 'panel', panelId: 'activeAgent' },
    { key: 'l' },
    openAgentLog,
  );

  const openSensorsDetail = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === SENSORS_DETAIL_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    const st = store.getState();
    overlayHost.push(
      createSensorsDetailOverlay(
        st.sensors,
        colorMode,
        st.focus.focusedSensorId,
      ),
    );
  }, [colorMode, overlayHost, store]);

  const setFocusedSensorId = useCallback(
    (sensorId: string | null) => {
      store.setState((state) => ({
        ...state,
        focus: { ...state.focus, focusedSensorId: sensorId },
      }));
    },
    [store],
  );

  useKeybinding(
    { kind: 'panel', panelId: 'sensors' },
    { key: 's' },
    openSensorsDetail,
  );

  const cycleDiffFile = useCallback(() => {
    store.setState((state) => {
      const dp = state.diffPreview;
      const paths =
        dp.changedPaths.length > 0
          ? dp.changedPaths
          : dp.activePath
            ? [dp.activePath]
            : [];
      if (paths.length === 0) {
        return state;
      }
      const nextIdx = (dp.activeIndex + 1) % paths.length;
      const nextPath = paths[nextIdx];
      if (nextPath === undefined) {
        return state;
      }
      const nextUnified = dp.diffByPath[nextPath] ?? '';
      return {
        ...state,
        diffPreview: {
          ...dp,
          mode: 'diff',
          activeIndex: nextIdx,
          activePath: nextPath,
          unifiedDiff: nextUnified,
        },
      };
    });
  }, [store]);

  const setDiffPreviewMode = useCallback(
    (mode: 'preview' | 'feedback') => {
      store.setState((state) => ({
        ...state,
        diffPreview: { ...state.diffPreview, mode },
      }));
    },
    [store],
  );

  const openFeedbackHistory = useCallback(() => {
    const alreadyOpen = overlayHost.overlays.some(
      (overlay) => overlay.id === FEEDBACK_HISTORY_OVERLAY_ID,
    );
    if (alreadyOpen) {
      return;
    }
    setDiffPreviewMode('feedback');
    overlayHost.push(
      createFeedbackHistoryOverlay(
        store.getState().diffPreview.feedbackHistory,
        colorMode,
      ),
    );
  }, [colorMode, overlayHost, setDiffPreviewMode, store]);

  useKeybinding(
    { kind: 'panel', panelId: 'diff' },
    { key: 'd' },
    cycleDiffFile,
  );
  useKeybinding({ kind: 'panel', panelId: 'diff' }, { key: 'p' }, () => {
    setDiffPreviewMode('preview');
  });
  useKeybinding(
    { kind: 'panel', panelId: 'diff' },
    { key: 'r' },
    openFeedbackHistory,
  );

  if (mode === 'discovery') {
    const onChoice =
      discovery?.onChoice ??
      (() => {
        /* no-op when discovery props omitted */
      });
    return (
      <Box flexDirection="column" width={size.columns}>
        <Header mode={mode} header={header} colorMode={colorMode} />
        <DiscoveryScreen store={store} onChoice={onChoice} />
      </Box>
    );
  }

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
              pipelineStage={pipeline.stage}
              pipelineStatus={pipeline.status}
              focused={focus.panelId === 'activeAgent'}
              colorMode={colorMode}
            />
          ),
          sprints: (
            <SprintsPanel
              sprints={sprints}
              selectedSprintIdx={focus.selectedSprintIdx}
              focused={focus.panelId === 'sprints'}
              colorMode={colorMode}
            />
          ),
          sensors: (
            <SensorsPanel
              sensors={sensors}
              focusedSensorId={focus.focusedSensorId}
              onFocusedSensorIdChange={setFocusedSensorId}
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
      <CommandInput
        {...(commandExecutor ? { executor: commandExecutor } : {})}
        disabled={overlayHost.overlays.length > 0}
        colorMode={colorMode}
      />
      <Footer state={footerState} colorMode={colorMode} />
    </Box>
  );
}

const SPRINT_DIGITS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];

function useSprintDigitKeybindings(onSelect: (idx: number) => void): void {
  const context = useKeybindingContext();
  useEffect(() => {
    const unregisters = SPRINT_DIGITS.map((digit) =>
      context.router.register({
        scope: { kind: 'panel', panelId: 'sprints' },
        binding: { key: digit },
        handler: () => {
          onSelect(Number.parseInt(digit, 10));
        },
      }),
    );
    return () => {
      for (const unregister of unregisters) {
        unregister();
      }
    };
  }, [context.router, onSelect]);
}
