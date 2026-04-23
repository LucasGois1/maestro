import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createEventBus, type MaestroEvent } from '@maestro/core';
import { createStateStore } from '@maestro/state';
import { bridgeBusToStore, createTuiStore } from '@maestro/tui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { editSprintContractMock, inkRenderMock, resolveContractPathMock } =
  vi.hoisted(() => ({
    editSprintContractMock: vi.fn(async () => undefined),
    inkRenderMock: vi.fn(() => ({ unmount: vi.fn() })),
    resolveContractPathMock: vi.fn(),
  }));

vi.mock('@maestro/contract', () => ({
  editSprintContract: editSprintContractMock,
  resolveContractPath: resolveContractPathMock,
}));

vi.mock('ink', () => ({
  render: inkRenderMock,
}));

vi.mock('../resolve-workspace-header.js', () => ({
  resolveWorkspaceHeader: vi.fn(async () => ({
    repoName: 'mock-repo',
    branch: 'main',
  })),
}));

import { createTuiCommand, defaultRenderApp } from './tui.js';

let tempDir: string | undefined;

describe('createTuiCommand', () => {
  beforeEach(async () => {
    vi.stubEnv('MAESTRO_SKIP_WORKSPACE_TRUST', '1');
    tempDir = await mkdtemp(join(tmpdir(), 'maestro-cli-tui-'));
    inkRenderMock.mockClear();
    editSprintContractMock.mockClear();
    resolveContractPathMock.mockReset();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('renders the App without demo events by default', async () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const startDemo = vi.fn();

    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: startDemo as never,
      env: {},
    });
    await command.parseAsync([], { from: 'user' });

    expect(renderApp).toHaveBeenCalledOnce();
    expect(startDemo).not.toHaveBeenCalled();
    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
      onForceExit?: () => void;
    };
    expect(args.colorMode).toBe('color');
    expect(typeof args.onForceExit).toBe('function');
  });

  it('starts the demo when --demo is provided', async () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const startDemo = vi.fn();

    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: startDemo as never,
      env: {},
    });
    await command.parseAsync(['--demo'], { from: 'user' });

    expect(startDemo).toHaveBeenCalledOnce();
  });

  it('honors --no-color and NO_COLOR', async () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: vi.fn() as never,
      env: { NO_COLOR: '1' },
    });
    await command.parseAsync([], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
    };
    expect(args.colorMode).toBe('no-color');
  });

  it('forces no-color when --no-color flag is used', async () => {
    const renderApp = vi.fn(() => ({ unmount: vi.fn() }));
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: vi.fn() as never,
      env: {},
    });
    await command.parseAsync(['--no-color'], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      colorMode: 'color' | 'no-color';
    };
    expect(args.colorMode).toBe('no-color');
  });

  it('passes a shared bus that demo events feed into', async () => {
    const renderApp = vi.fn(
      (args: { bus: ReturnType<typeof createEventBus>; store: unknown }) => {
        const dispose = bridgeBusToStore(
          args.bus,
          args.store as ReturnType<typeof createTuiStore>,
        );
        return {
          unmount: vi.fn(() => {
            dispose();
          }),
        };
      },
    );
    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: (bus: { emit(event: MaestroEvent): void }) => {
        bus.emit({ type: 'pipeline.started', runId: 'r1' });
        return { cancel: vi.fn(), totalDurationMs: 0 };
      },
      env: {},
    });

    await command.parseAsync(['--demo'], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      store: { getState: () => { mode: string } };
    };
    expect(args.store.getState().mode).toBe('run');
  });

  it('wires contract resolution and edit remount callbacks', async () => {
    if (!tempDir) {
      throw new Error('temporary directory was not created');
    }
    const contractPath = join(tempDir, 'contract.md');
    await writeFile(contractPath, '# Contract\n', 'utf8');
    resolveContractPathMock.mockReturnValue(contractPath);
    const firstUnmount = vi.fn();
    const renderApp = vi
      .fn()
      .mockReturnValueOnce({ unmount: firstUnmount })
      .mockReturnValue({ unmount: vi.fn() });

    const command = createTuiCommand({
      renderApp: renderApp as never,
      startDemo: vi.fn() as never,
      env: {},
    });
    await command.parseAsync([], { from: 'user' });

    const args = renderApp.mock.calls[0]?.[0] as {
      editPlan: {
        resolveContractPath: (state: unknown) => string | null;
        onEditPath: (path: string) => Promise<void>;
      };
    };

    expect(
      args.editPlan.resolveContractPath({
        runId: 'run-1',
        pipeline: { sprintIdx: 0 },
      }),
    ).toBe(contractPath);
    expect(
      args.editPlan.resolveContractPath({
        runId: null,
        pipeline: { sprintIdx: null },
      }),
    ).toBeNull();

    await args.editPlan.onEditPath(contractPath);

    expect(firstUnmount).toHaveBeenCalledOnce();
    expect(editSprintContractMock).toHaveBeenCalledWith({
      filePath: contractPath,
    });
    expect(renderApp).toHaveBeenCalledTimes(2);
  });

  it('defaultRenderApp renders an Ink instance and can unmount', () => {
    const bus = createEventBus();
    const store = createTuiStore({ colorMode: 'no-color' });
    const repoRoot = tempDir ?? process.cwd();
    const stateStore = createStateStore({ repoRoot });
    const instance = defaultRenderApp({
      store,
      bus,
      colorMode: 'no-color',
      repoRoot,
      stateStore,
    });
    expect(typeof instance.unmount).toBe('function');
    expect(inkRenderMock).toHaveBeenCalledOnce();
    instance.unmount();
  });
});
