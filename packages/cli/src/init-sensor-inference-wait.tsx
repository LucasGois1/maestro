import type { MaestroConfig } from '@maestro/config';
import {
  runSensorCandidateInference,
  type RunSensorCandidateInferenceResult,
} from '@maestro/discovery';
import {
  Header,
  resolveColorMode,
  useSpinnerFrame,
  type TuiColorMode,
  type TuiHeaderState,
} from '@maestro/tui';
import { Box, Text, render } from 'ink';
import { basename } from 'node:path';
import { createElement } from 'react';

import { clearTerminalViewport } from './terminal-viewport.js';

type WaitRootProps = {
  readonly repoRoot: string;
  readonly colorMode: TuiColorMode;
  readonly useLlm: boolean;
};

function SensorInferenceWaitRoot(props: WaitRootProps) {
  const useColor = props.colorMode === 'color';
  const spinner = useSpinnerFrame({ enabled: true, intervalMs: 100 });
  const headerState: TuiHeaderState = {
    repoName: basename(props.repoRoot),
    branch: 'init · sensors',
    sprintIdx: null,
    totalSprints: null,
    contextPct: null,
    updateAvailable: false,
  };

  return (
    <Box flexDirection="column" width="100%">
      <Header mode="idle" header={headerState} colorMode={props.colorMode} />
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        <Text bold {...(useColor ? { color: 'cyan' } : {})}>
          {spinner} Preparing sensor suggestions
        </Text>
        <Box marginTop={1}>
          <Text dimColor={useColor} wrap="wrap">
            {props.useLlm
              ? 'Scanning the repository and running the AI sensor agent. This can take up to a few minutes on large repos — the next screen will list candidates when ready.'
              : 'Scanning the repository for stack hints (AI suggestions skipped).'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Runs sensor candidate inference while showing the same header strip as the sensor
 * wizard so `maestro init` does not look frozen after the model picker unmounts.
 */
export async function runSensorCandidateInferenceWithProgressInk(options: {
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  readonly useLlm: boolean;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<RunSensorCandidateInferenceResult> {
  const colorMode = resolveColorMode({
    args: [],
    env: options.env ?? process.env,
  });

  const app = render(
    createElement(SensorInferenceWaitRoot, {
      repoRoot: options.repoRoot,
      colorMode,
      useLlm: options.useLlm,
    }),
    {
      exitOnCtrlC: false,
      interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
    },
  );

  try {
    try {
      return await runSensorCandidateInference({
        repoRoot: options.repoRoot,
        config: options.config,
        useLlm: options.useLlm,
      });
    } finally {
      app.unmount();
    }
  } finally {
    // Let Ink finish teardown writes before clearing, so the next Ink root does not stack.
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    clearTerminalViewport();
  }
}
