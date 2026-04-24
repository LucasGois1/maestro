import { useEffect, useRef } from 'react';

import type { EventBus } from '@maestro/core';

import {
  SHELL_APPROVAL_OVERLAY_PREFIX,
  createShellApprovalOverlay,
} from '../panels/ShellApprovalOverlay.js';
import type { TuiStore } from '../state/store.js';
import { useStoreSelector } from '../state/useStoreSelector.js';

import { useOverlayHost } from './OverlayHost.js';

export interface ShellApprovalGateProps {
  readonly store: TuiStore;
  readonly bus: EventBus;
}

/**
 * Abre automaticamente o overlay de aprovação quando `shell.approval_pending`
 * preenche `pipeline.shellApprovalPending` na store.
 */
export function ShellApprovalGate({ store, bus }: ShellApprovalGateProps) {
  const overlayHost = useOverlayHost();
  const pending = useStoreSelector(
    store,
    (s) => s.pipeline.shellApprovalPending,
  );
  const colorMode = useStoreSelector(store, (s) => s.colorMode);
  const pushedRef = useRef<string | null>(null);
  const hostRef = useRef(overlayHost);
  hostRef.current = overlayHost;

  useEffect(() => {
    const host = hostRef.current;
    if (pending === null) {
      if (pushedRef.current !== null) {
        const id = pushedRef.current;
        const top = host.overlays[host.overlays.length - 1];
        if (top?.id === id) {
          host.pop();
        }
        pushedRef.current = null;
      }
      return;
    }
    const id = `${SHELL_APPROVAL_OVERLAY_PREFIX}${pending.requestId}`;
    if (pushedRef.current === id) {
      return;
    }
    pushedRef.current = id;
    host.push(
      createShellApprovalOverlay({
        overlayId: id,
        bus,
        pending,
        colorMode,
      }),
    );
  }, [pending, bus, colorMode]);

  return null;
}
