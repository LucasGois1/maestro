import { Box, Text, useInput } from 'ink';
import type { ReactNode } from 'react';

import type { EventBus } from '@maestro/core';

import type { TuiColorMode, TuiShellApprovalPending } from '../state/store.js';

export const SHELL_APPROVAL_OVERLAY_PREFIX = 'shell-approval:';

export interface ShellApprovalOverlayProps {
  readonly bus: EventBus;
  readonly pending: TuiShellApprovalPending;
  readonly colorMode: TuiColorMode;
}

/**
 * Aprovação humana para um comando shell fora da allowlist / em modo strict.
 * [o] uma vez · [a] sempre (padrão `cmd *`) · [n] negar
 */
export function ShellApprovalOverlay({
  bus,
  pending,
  colorMode,
}: ShellApprovalOverlayProps): ReactNode {
  const useColor = colorMode === 'color';

  const emitResolved = (
    choice: 'once' | 'always' | 'deny',
    pattern?: string,
  ): void => {
    bus.emit({
      type: 'shell.approval_resolved',
      runId: pending.runId,
      requestId: pending.requestId,
      choice,
      ...(pattern !== undefined ? { pattern } : {}),
    });
  };

  useInput(
    (input, key) => {
      if (key.escape) {
        emitResolved('deny');
        return;
      }
      const ch = input.toLowerCase();
      if (ch === 'o') {
        emitResolved('once');
        return;
      }
      if (ch === 'a') {
        emitResolved('always', `${pending.cmd} *`);
        return;
      }
      if (ch === 'n') {
        emitResolved('deny');
      }
    },
    { isActive: true },
  );

  const reasonLabel =
    pending.reason === 'strict'
      ? 'modo strict (todos os comandos pedem confirmação)'
      : 'comando fora da allowlist';

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold {...(useColor ? { color: 'yellow' } : {})}>
        Aprovar comando shell
      </Text>
      <Text dimColor={useColor}>Motivo: {reasonLabel}</Text>
      {pending.agentId !== undefined ? (
        <Text dimColor={useColor}>Agente: {pending.agentId}</Text>
      ) : null}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Comando</Text>
        <Text wrap="wrap">{pending.commandLine}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor={useColor}>cwd: {pending.cwd}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor={useColor}>
          [o] Aprovar uma vez · [a] Aprovar sempre (padrão glob do binário) · [n]
          ou Esc Negar
        </Text>
      </Box>
    </Box>
  );
}

export function createShellApprovalOverlay(options: {
  readonly overlayId: string;
  readonly bus: EventBus;
  readonly pending: TuiShellApprovalPending;
  readonly colorMode: TuiColorMode;
}) {
  return {
    id: options.overlayId,
    title: 'Shell — aprovação',
    render: () => (
      <ShellApprovalOverlay
        bus={options.bus}
        pending={options.pending}
        colorMode={options.colorMode}
      />
    ),
  };
}
