import { describe, expect, it, vi } from 'vitest';

import { createEventBus } from '@maestro/core';
import type { ApprovalRequest } from '@maestro/sandbox';

import { createBusShellApprovalPrompter } from './bus-shell-approval-prompter.js';

const sampleRequest: ApprovalRequest = {
  cmd: 'gh',
  args: ['pr', 'create'],
  commandLine: 'gh pr create',
  cwd: '/tmp/repo',
  agentId: 'generator',
  reason: 'unmatched',
};

describe('createBusShellApprovalPrompter', () => {
  it('emite pending e resolve com once quando a bus recebe approval_resolved', async () => {
    const bus = createEventBus();
    const pending: unknown[] = [];
    bus.on((event) => {
      if (event.type === 'shell.approval_pending') {
        pending.push(event);
      }
    });

    const { approver, dispose } = createBusShellApprovalPrompter({
      bus,
      runId: 'run-a',
      randomId: () => 'rid-1',
    });

    const decisionPromise = approver(sampleRequest);

    await vi.waitFor(() => {
      expect(pending).toHaveLength(1);
    });

    bus.emit({
      type: 'shell.approval_resolved',
      runId: 'run-a',
      requestId: 'rid-1',
      choice: 'once',
    });

    await expect(decisionPromise).resolves.toEqual({ choice: 'once' });
    dispose();
  });

  it('mapeia always com pattern', async () => {
    const bus = createEventBus();
    const { approver, dispose } = createBusShellApprovalPrompter({
      bus,
      runId: 'run-b',
      randomId: () => 'rid-2',
    });

    const decisionPromise = approver(sampleRequest);

    bus.emit({
      type: 'shell.approval_resolved',
      runId: 'run-b',
      requestId: 'rid-2',
      choice: 'always',
      pattern: 'gh pr *',
    });

    await expect(decisionPromise).resolves.toEqual({
      choice: 'always',
      pattern: 'gh pr *',
    });
    dispose();
  });

  it('dispose nega pedidos pendentes', async () => {
    const bus = createEventBus();
    const { approver, dispose } = createBusShellApprovalPrompter({
      bus,
      runId: 'run-c',
      randomId: () => 'rid-3',
    });

    const decisionPromise = approver(sampleRequest);
    dispose();

    await expect(decisionPromise).resolves.toEqual({
      choice: 'deny',
      denyReason: 'approval_disposed',
    });
  });

  it('mapeia deny da TUI como decisão explícita do utilizador', async () => {
    const bus = createEventBus();
    const pending: unknown[] = [];
    bus.on((event) => {
      if (event.type === 'shell.approval_pending') {
        pending.push(event);
      }
    });
    const { approver, dispose } = createBusShellApprovalPrompter({
      bus,
      runId: 'run-e',
      randomId: () => 'rid-5',
    });

    const decisionPromise = approver(sampleRequest);
    await vi.waitFor(() => {
      expect(pending).toHaveLength(1);
    });

    bus.emit({
      type: 'shell.approval_resolved',
      runId: 'run-e',
      requestId: 'rid-5',
      choice: 'deny',
    });

    await expect(decisionPromise).resolves.toEqual({
      choice: 'deny',
      denyReason: 'user',
    });
    dispose();
  });

  it('ignora resolved com runId diferente até timeout', async () => {
    vi.useFakeTimers();
    try {
      const bus = createEventBus();
      const { approver, dispose } = createBusShellApprovalPrompter({
        bus,
        runId: 'run-d',
        timeoutMs: 100,
        randomId: () => 'rid-4',
      });

      const decisionPromise = approver(sampleRequest);

      bus.emit({
        type: 'shell.approval_resolved',
        runId: 'other-run',
        requestId: 'rid-4',
        choice: 'once',
      });

      await vi.advanceTimersByTimeAsync(100);

      await expect(decisionPromise).resolves.toEqual({
        choice: 'deny',
        denyReason: 'approval_timeout',
      });
      dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
