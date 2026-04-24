import { randomUUID } from 'node:crypto';

import type { EventBus, ShellApprovalEvent } from '@maestro/core';
import type {
  ApprovalDecision,
  ApprovalPrompter,
  ApprovalRequest,
} from '@maestro/sandbox';

const DEFAULT_TIMEOUT_MS = 900_000;

function mapResolvedEventToDecision(
  event: Extract<ShellApprovalEvent, { type: 'shell.approval_resolved' }>,
): ApprovalDecision {
  if (event.choice === 'deny') {
    return { choice: 'deny', denyReason: 'user' };
  }
  if (event.choice === 'once') {
    return { choice: 'once' };
  }
  return {
    choice: 'always',
    ...(event.pattern !== undefined ? { pattern: event.pattern } : {}),
  };
}

export type BusShellApprovalPrompter = {
  readonly approver: ApprovalPrompter;
  readonly dispose: () => void;
};

/**
 * Prompter que emite `shell.approval_pending` na bus e aguarda `shell.approval_resolved`
 * (normalmente pela TUI). Sem TUI, o pedido expira após `timeoutMs` com deny.
 */
export function createBusShellApprovalPrompter(options: {
  readonly bus: EventBus;
  readonly runId: string;
  readonly timeoutMs?: number;
  readonly randomId?: () => string;
}): BusShellApprovalPrompter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const randomId = options.randomId ?? (() => randomUUID());
  const pending = new Map<
    string,
    { readonly resolve: (d: ApprovalDecision) => void; readonly timer: NodeJS.Timeout }
  >();

  const unsubscribe = options.bus.on((event) => {
    if (event.type !== 'shell.approval_resolved') {
      return;
    }
    if (event.runId !== options.runId) {
      return;
    }
    const slot = pending.get(event.requestId);
    if (slot === undefined) {
      return;
    }
    pending.delete(event.requestId);
    clearTimeout(slot.timer);
    slot.resolve(mapResolvedEventToDecision(event));
  });

  const dispose = (): void => {
    unsubscribe();
    for (const [, slot] of pending) {
      clearTimeout(slot.timer);
      slot.resolve({ choice: 'deny', denyReason: 'approval_disposed' });
    }
    pending.clear();
  };

  const approver: ApprovalPrompter = async (request: ApprovalRequest) => {
    const requestId = randomId();
    return new Promise<ApprovalDecision>((resolve) => {
      const timer = setTimeout(() => {
        if (!pending.has(requestId)) {
          return;
        }
        pending.delete(requestId);
        resolve({ choice: 'deny', denyReason: 'approval_timeout' });
      }, timeoutMs);
      pending.set(requestId, { resolve, timer });
      options.bus.emit({
        type: 'shell.approval_pending',
        runId: options.runId,
        requestId,
        ...(request.agentId !== undefined ? { agentId: request.agentId } : {}),
        cmd: request.cmd,
        args: [...request.args],
        commandLine: request.commandLine,
        cwd: request.cwd,
        reason: request.reason,
      });
    });
  };

  return { approver, dispose };
}
