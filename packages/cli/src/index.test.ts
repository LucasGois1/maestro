import { describe, expect, it, vi } from 'vitest';

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(() => ({
    unmount: vi.fn(),
  })),
}));

vi.mock('ink', () => ({
  render: renderMock,
}));

vi.mock('@maestro/tui', () => ({
  HelloWorld: () => null,
}));

import { createProgram, runCli } from './index.ts';
import { executeCliFromProcess } from './index.ts';

describe('@maestro/cli index', () => {
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

  it('renders the ink app when no CLI flags are provided', () => {
    runCli([], { stdoutIsTTY: true, version: '0.0.1' });

    expect(renderMock).toHaveBeenCalledOnce();
  });

  it('unmounts the ink app in non-interactive mode', () => {
    vi.useFakeTimers();

    const unmount = vi.fn();
    renderMock.mockReturnValueOnce({ unmount });

    runCli([], { stdoutIsTTY: false, version: '0.0.1' });
    vi.runAllTimers();

    expect(unmount).toHaveBeenCalledOnce();

    vi.useRealTimers();
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
