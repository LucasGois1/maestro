import type { SensorInitCandidate } from '@maestro/discovery';
import type { SensorDefinition } from '@maestro/sensors';
import { sensorsFileSchema } from '@maestro/sensors';
import { Box, render, Text, useInput } from 'ink';
import {
  createElement,
  useCallback,
  useState,
  type ReactNode,
} from 'react';

import { resolveColorMode, type TuiColorMode } from '@maestro/tui';

const INTRO = `Sensors (harness feedback)

Maestro uses sensors to close the feedback loop around agents: commands and checks
that run after edits so the pipeline can verify work with deterministic signals
(tests, lint, typecheck, security scans, etc.).

Why at least one sensor is required:
Agent-first workflows fail open without verifiable checks. A minimum harness of
one computational sensor materially improves confidence and output quality by
giving the generator and evaluator something concrete to run before approval.

You can add suggested commands from this repository, optional catalog entries
(Snyk, SonarQube, semgrep), an inferential code-review preset, or define a custom
shell command.

Press Enter to continue.`;

const CODE_REVIEW_PRESET: SensorDefinition = {
  id: 'code-review',
  kind: 'inferential',
  agent: 'code-reviewer',
  onFail: 'warn',
  appliesTo: ['**/*.{py,ts,tsx,js,jsx,go,rs,java}'],
  criteria: [],
  timeoutSec: 60,
};

function candidateToSensor(c: SensorInitCandidate): SensorDefinition {
  return {
    id: c.id,
    kind: 'computational',
    command: c.command,
    args: [...c.args],
    ...(c.cwd !== undefined ? { cwd: c.cwd } : {}),
    onFail: c.onFail,
    appliesTo: ['**/*'],
    timeoutSec: 600,
    expectExitCode: 0,
    parseOutput: 'generic',
  };
}

type WizardPhase = 'intro' | 'main' | 'manual';

type ManualStep = 'id' | 'command' | 'args';

type WizardRootProps = {
  readonly colorMode: TuiColorMode;
  readonly candidates: readonly SensorInitCandidate[];
  readonly initialSensors: readonly SensorDefinition[];
  readonly onDone: (sensorsFile: ReturnType<typeof sensorsFileSchema.parse>) => void;
  readonly onAbort: (message: string) => void;
};

function SensorsWizardRoot(props: WizardRootProps): ReactNode {
  const [phase, setPhase] = useState<WizardPhase>('intro');
  const [registered, setRegistered] = useState<SensorDefinition[]>(() => [
    ...props.initialSensors,
  ]);
  const [cursor, setCursor] = useState(0);
  const [manualStep, setManualStep] = useState<ManualStep>('id');
  const [bufId, setBufId] = useState('');
  const [bufCmd, setBufCmd] = useState('');
  const [bufArgs, setBufArgs] = useState('');

  const finishIfValid = useCallback(() => {
    const parsed = sensorsFileSchema.safeParse({
      concurrency: 4,
      sensors: registered,
    });
    if (!parsed.success) {
      props.onAbort(parsed.error.message);
      return;
    }
    props.onDone(parsed.data);
  }, [props, registered]);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        props.onAbort('Sensor setup cancelled.');
        return;
      }
      if (phase === 'intro') {
        if (key.return) {
          setPhase('main');
        }
        return;
      }
      if (phase === 'manual') {
        if (key.escape) {
          setPhase('main');
          setManualStep('id');
          setBufId('');
          setBufCmd('');
          setBufArgs('');
          return;
        }
        const activeBuf =
          manualStep === 'id'
            ? bufId
            : manualStep === 'command'
              ? bufCmd
              : bufArgs;
        const setActive =
          manualStep === 'id'
            ? setBufId
            : manualStep === 'command'
              ? setBufCmd
              : setBufArgs;
        if (key.return) {
          if (manualStep === 'id') {
            if (bufId.trim().length === 0) {
              return;
            }
            setManualStep('command');
            return;
          }
          if (manualStep === 'command') {
            if (bufCmd.trim().length === 0) {
              return;
            }
            setManualStep('args');
            return;
          }
          const id = bufId.trim();
          const cmd = bufCmd.trim();
          const parts = bufArgs.trim().length > 0 ? bufArgs.trim().split(/\s+/u) : [];
          const exists = registered.some((s) => s.id === id);
          if (exists) {
            return;
          }
          const sensor: SensorDefinition = {
            id,
            kind: 'computational',
            command: cmd,
            args: parts,
            onFail: 'block',
            appliesTo: ['**/*'],
            timeoutSec: 600,
            expectExitCode: 0,
            parseOutput: 'generic',
          };
          setRegistered((r) => [...r, sensor]);
          setPhase('main');
          setManualStep('id');
          setBufId('');
          setBufCmd('');
          setBufArgs('');
          return;
        }
        if (key.backspace || key.delete) {
          setActive(activeBuf.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setActive(activeBuf + input);
        }
        return;
      }

      if (phase === 'main') {
        if (input === 'f' || input === 'F') {
          if (registered.length >= 1) {
            finishIfValid();
          }
          return;
        }
        if (input === 'i' || input === 'I') {
          if (!registered.some((s) => s.id === 'code-review')) {
            setRegistered((r) => [...r, CODE_REVIEW_PRESET]);
          }
          return;
        }
        if (input === 'm' || input === 'M') {
          setPhase('manual');
          setManualStep('id');
          setBufId('');
          setBufCmd('');
          setBufArgs('');
          return;
        }
        if (input === 'u' || input === 'U') {
          setRegistered((r) => r.slice(0, -1));
          return;
        }
        if (key.upArrow) {
          setCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow) {
          setCursor((c) =>
            Math.min(Math.max(props.candidates.length - 1, 0), c + 1),
          );
          return;
        }
        if (key.return) {
          const c = props.candidates[cursor];
          if (c === undefined) {
            return;
          }
          const sensor = candidateToSensor(c);
          if (registered.some((s) => s.id === sensor.id)) {
            return;
          }
          setRegistered((r) => [...r, sensor]);
        }
      }
    },
    {
      isActive: true,
    },
  );

  if (phase === 'intro') {
    return (
      <Box flexDirection="column" marginY={1}>
        {props.colorMode === 'color' ? (
          <Text color="cyan">Sensor setup (required)</Text>
        ) : (
          <Text>Sensor setup (required)</Text>
        )}
        <Text>{INTRO}</Text>
      </Box>
    );
  }

  if (phase === 'manual') {
    const label =
      manualStep === 'id'
        ? 'Sensor id (kebab-case)'
        : manualStep === 'command'
          ? 'Command (executable name or path)'
          : 'Arguments (space-separated, optional — press Enter if empty)';
    const value =
      manualStep === 'id' ? bufId : manualStep === 'command' ? bufCmd : bufArgs;
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color="yellow">Manual sensor</Text>
        <Text dimColor>Esc back · Enter next / submit on args step</Text>
        <Text>
          {label}: {value}█
        </Text>
      </Box>
    );
  }

  const canFinish = registered.length >= 1;
  const list = props.candidates.map((c, i) => {
    const mark = i === cursor ? '›' : ' ';
    const tag = `[${c.source}]`;
    return `${mark} ${tag} ${c.id}: ${c.command} ${c.args.join(' ')}`.trimEnd();
  });

  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold>Sensors</Text>
      <Text dimColor>
        Arrows move · Enter add focused · i inferential preset · m manual · u undo
        last · f finish{canFinish ? '' : ' (need at least 1)'}
      </Text>
      <Text>{'\n'}Registered ({String(registered.length)}):</Text>
      {registered.length === 0 ? (
        <Text dimColor>(none yet)</Text>
      ) : (
        registered.map((s) => (
          <Text key={s.id}>
            - {s.id} ({s.kind})
          </Text>
        ))
      )}
      <Text>{'\n'}Candidates:</Text>
      {list.length === 0 ? (
        <Text dimColor>(no suggestions)</Text>
      ) : (
        list.map((line, idx) => <Text key={idx}>{line}</Text>)
      )}
    </Box>
  );
}

export type InitSensorsWizardResult =
  | { readonly kind: 'done'; readonly sensorsFile: ReturnType<typeof sensorsFileSchema.parse> }
  | { readonly kind: 'abort'; readonly message: string };

export async function runInitSensorsWizard(options: {
  readonly candidates: readonly SensorInitCandidate[];
  readonly initialSensors: readonly SensorDefinition[];
  readonly env?: NodeJS.ProcessEnv;
}): Promise<InitSensorsWizardResult> {
  const colorMode = resolveColorMode({ args: [], env: options.env ?? process.env });

  return await new Promise<InitSensorsWizardResult>((resolve) => {
    const app = render(
      createElement(SensorsWizardRoot, {
        colorMode,
        candidates: options.candidates,
        initialSensors: options.initialSensors,
        onDone: (sensorsFile) => {
          app.unmount();
          resolve({ kind: 'done', sensorsFile });
        },
        onAbort: (message) => {
          app.unmount();
          resolve({ kind: 'abort', message });
        },
      }),
      { exitOnCtrlC: false },
    );
  });
}
