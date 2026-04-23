import type { MaestroConfig } from '@maestro/config';
import type { KBManager } from '@maestro/kb';
import { loadSensorsFile } from '@maestro/sensors';

import { runSensorCandidateInferenceWithProgressInk } from './init-sensor-inference-wait.js';
import { runInitSensorsWizard } from './init-sensors-wizard.js';

type Io = {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
};

export function printNonInteractiveSensorSetupHint(io: Io, repoRoot: string): void {
  io.stdout('');
  io.stdout(
    'Maestro init: interactive sensor setup was skipped (non-TTY or automation).',
  );
  io.stdout(
    'Add at least one sensor to .maestro/sensors.json — computational commands (tests, lint) are the primary harness feedback loop.',
  );
  io.stdout(`Repository: ${repoRoot}`);
  io.stdout(
    'Minimal example (computational): {"concurrency":4,"sensors":[{"id":"test","kind":"computational","command":"pnpm","args":["run","test"],"onFail":"block","appliesTo":["**/*"],"timeoutSec":600,"expectExitCode":0,"parseOutput":"generic"}]}',
  );
  io.stdout(
    'Use `maestro init` in an interactive terminal to run the sensor wizard, or pass --skip-sensor-wizard in CI after you commit a valid sensors.json.',
  );
}

export type SensorPhaseFlags = {
  readonly ai: boolean;
  readonly skipSensorWizard?: boolean;
};

/**
 * Interactive wizard when TTY; English hint when not. Returns false if the user aborts.
 */
export async function runSensorSetupAfterKbInit(options: {
  readonly repoRoot: string;
  readonly kb: KBManager;
  readonly config: MaestroConfig;
  readonly flags: SensorPhaseFlags;
  readonly io: Io;
}): Promise<boolean> {
  if (options.flags.skipSensorWizard === true) {
    return true;
  }
  const tty = process.stdout.isTTY && process.stdin.isTTY;
  if (!tty) {
    printNonInteractiveSensorSetupHint(options.io, options.repoRoot);
    return true;
  }

  const useLlm = options.flags.ai !== false;
  const { candidates, llmWarning } = await runSensorCandidateInferenceWithProgressInk({
    repoRoot: options.repoRoot,
    config: options.config,
    useLlm,
    env: process.env,
  });

  if (llmWarning !== undefined) {
    options.io.stderr(`AI sensor suggestions unavailable: ${llmWarning}`);
  }

  const existing = await loadSensorsFile({ repoRoot: options.repoRoot });
  const wizard = await runInitSensorsWizard({
    repoRoot: options.repoRoot,
    candidates,
    initialSensors: existing.sensors,
    env: process.env,
    ...(llmWarning !== undefined ? { llmWarning } : {}),
  });

  if (wizard.kind === 'abort') {
    options.io.stderr(wizard.message);
    return false;
  }

  const serialized = `${JSON.stringify(wizard.sensorsFile, null, 2)}\n`;
  await options.kb.write('sensors.json', serialized);
  return true;
}
