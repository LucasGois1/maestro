import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(() => ({
    unmount: vi.fn(),
  })),
}));

vi.mock('ink', () => ({
  render: renderMock,
}));

vi.mock('@maestro/tui', () => ({
  App: () => null,
  createTuiStore: vi.fn(() => ({
    getState: vi.fn(() => ({ mode: 'idle' })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    select: vi.fn(() => vi.fn()),
  })),
  playDemoEvents: vi.fn(() => ({ cancel: vi.fn(), totalDurationMs: 0 })),
  resolveColorMode: vi.fn(() => 'color'),
}));

vi.mock('@maestro/core', () => ({
  createEventBus: vi.fn(() => ({
    emit: vi.fn(),
    on: vi.fn(() => vi.fn()),
  })),
}));

vi.mock('./tui-workspace-store.js', () => ({
  createTuiStoreForWorkspace: vi.fn(async () => ({
    getState: vi.fn(() => ({ mode: 'idle' })),
    setState: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    select: vi.fn(() => vi.fn()),
  })),
}));

vi.mock('./workspace-trust.js', () => ({
  ensureWorkspaceTrustInteractive: vi.fn(async () => true),
}));

import { createProgram, runCli } from './index.ts';
import { executeCliFromProcess } from './index.ts';

describe('@maestro/cli index', () => {
  beforeEach(() => {
    vi.stubEnv('MAESTRO_SKIP_WORKSPACE_TRUST', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('configures the commander program metadata', () => {
    const program = createProgram('0.0.1');

    expect(program.name()).toBe('maestro');
    expect(program.description()).toBe('Multi-agent coding orchestrator');
  });

  it('delegates help and version parsing to the configured program', () => {
    const program = {
      parse: vi.fn(),
    };

    runCli(['--version'], { program, version: '0.0.1' });
    runCli(['--help'], { program, version: '0.0.1' });

    expect(program.parse).toHaveBeenCalledWith([
      'node',
      'maestro',
      '--version',
    ]);
    expect(program.parse).toHaveBeenCalledWith(['node', 'maestro', '--help']);
  });

  it('renders the ink app when no CLI flags are provided', async () => {
    runCli([], { stdoutIsTTY: true, version: '0.0.1' });

    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledOnce();
    });
  });

  it('routes maestro tui to the command path', () => {
    const program = { parse: vi.fn() };

    runCli(['tui'], { program, version: '0.0.1' });

    expect(program.parse).toHaveBeenCalledWith(['node', 'maestro', 'tui']);
  });

  it('routes maestro init to the command path', () => {
    const program = { parse: vi.fn() };

    runCli(['init', '--no-ai'], { program, version: '0.0.1' });

    expect(program.parse).toHaveBeenCalledWith([
      'node',
      'maestro',
      'init',
      '--no-ai',
    ]);
  });

  it('unmounts the ink app in non-interactive mode', async () => {
    const unmount = vi.fn();
    renderMock.mockReturnValueOnce({ unmount });

    runCli([], { stdoutIsTTY: false, version: '0.0.1' });
    await vi.waitFor(() => {
      expect(renderMock).toHaveBeenCalledOnce();
    });
    await vi.waitFor(
      () => {
        expect(unmount).toHaveBeenCalledOnce();
      },
      { timeout: 3000 },
    );
  });

  it('does not execute from process args when no entrypoint is present', () => {
    const run = vi.fn();

    expect(executeCliFromProcess(['node'], { run })).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('executes from process args when the module path matches the current entrypoint', () => {
    const run = vi.fn();
    const moduleUrl = 'file:///repo/packages/cli/src/index.ts';

    expect(
      executeCliFromProcess(
        ['node', '/repo/packages/cli/src/index.ts', '--version'],
        { moduleUrl, run },
      ),
    ).toBe(true);
    expect(run).toHaveBeenCalledWith(['--version']);
  });
});
