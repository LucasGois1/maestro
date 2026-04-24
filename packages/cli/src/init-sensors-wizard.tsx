import type { SensorInitCandidate } from '@maestro/discovery';
import type { SensorDefinition } from '@maestro/sensors';
import { sensorsFileSchema } from '@maestro/sensors';
import {
  Header,
  resolveColorMode,
  useTerminalSize,
  type TuiColorMode,
  type TuiHeaderState,
} from '@maestro/tui';
import { Box, render, Text, useInput } from 'ink';
import { basename } from 'node:path';
import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearTerminalViewport } from './terminal-viewport.js';

const BULLET_ON = '\u25CF';
const BULLET_OFF = '\u25CB';

const INTRO = `Sensors (harness feedback)

Maestro uses sensors to close the feedback loop around agents: commands and checks
that run after edits so the pipeline can verify work with deterministic signals
(tests, lint, typecheck, security scans, etc.).

Why at least one sensor is required:
Agent-first workflows fail open without verifiable checks. A minimum harness of
one computational sensor materially improves confidence and output quality by
giving the generator and evaluator something concrete to run before approval.

You can toggle suggested commands below, add the inferential code-review preset,
or define a custom shell command (m).`;

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

type ListRow =
  | { readonly kind: 'candidate'; readonly c: SensorInitCandidate }
  | { readonly kind: 'inferential' }
  | { readonly kind: 'manual'; readonly sensor: SensorDefinition };

function buildListRows(
  candidates: readonly SensorInitCandidate[],
  manualExtras: readonly SensorDefinition[],
): ListRow[] {
  const rows: ListRow[] = candidates.map((c) => ({
    kind: 'candidate' as const,
    c,
  }));
  rows.push({ kind: 'inferential' });
  for (const s of manualExtras) {
    rows.push({ kind: 'manual', sensor: s });
  }
  return rows;
}

function initialManualExtras(
  initial: readonly SensorDefinition[],
  candidates: readonly SensorInitCandidate[],
): SensorDefinition[] {
  const candIds = new Set(candidates.map((c) => c.id));
  return initial.filter(
    (s) => s.kind === 'computational' && !candIds.has(s.id),
  );
}

function initialSelectedIds(initial: readonly SensorDefinition[]): string[] {
  const out: string[] = [];
  for (const s of initial) {
    if (!out.includes(s.id)) {
      out.push(s.id);
    }
  }
  return out;
}

function buildOrderedSensors(
  rows: readonly ListRow[],
  selected: ReadonlySet<string>,
): SensorDefinition[] {
  const out: SensorDefinition[] = [];
  for (const row of rows) {
    if (row.kind === 'candidate') {
      if (selected.has(row.c.id)) {
        out.push(candidateToSensor(row.c));
      }
    } else if (row.kind === 'inferential') {
      if (selected.has('code-review')) {
        out.push(CODE_REVIEW_PRESET);
      }
    } else if (selected.has(row.sensor.id)) {
      out.push(row.sensor);
    }
  }
  return out;
}

type WizardPhase = 'intro' | 'main' | 'manual';

type ManualStep = 'id' | 'command' | 'args';

type WizardRootProps = {
  readonly repoRoot: string;
  readonly colorMode: TuiColorMode;
  readonly candidates: readonly SensorInitCandidate[];
  readonly initialSensors: readonly SensorDefinition[];
  /** Shown when the LLM discovery step failed but heuristic/catalog suggestions are still available. */
  readonly llmWarning?: string;
  readonly onDone: (
    sensorsFile: ReturnType<typeof sensorsFileSchema.parse>,
  ) => void;
  readonly onAbort: (message: string) => void;
};

function focusDetailPanel(
  row: ListRow | undefined,
  useColor: boolean,
): ReactNode {
  if (row === undefined) {
    return (
      <Text dimColor={useColor} wrap="wrap">
        (no row)
      </Text>
    );
  }
  if (row.kind === 'candidate') {
    const c = row.c;
    const cmdLine = [c.command, ...c.args].join(' ').trim();
    const cwdLine =
      c.cwd !== undefined && c.cwd.length > 0
        ? `Working directory: ${c.cwd}`
        : null;
    return (
      <Box flexDirection="column">
        <Text bold>Command</Text>
        <Text wrap="wrap">{cmdLine.length > 0 ? cmdLine : '(no args)'}</Text>
        {cwdLine !== null ? (
          <Box marginTop={1}>
            <Text dimColor={useColor} wrap="wrap">
              {cwdLine}
            </Text>
          </Box>
        ) : null}
        {c.rationale.length > 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>Rationale</Text>
            <Text dimColor={useColor} wrap="wrap">
              {c.rationale}
            </Text>
          </Box>
        ) : null}
      </Box>
    );
  }
  if (row.kind === 'inferential') {
    return (
      <Box flexDirection="column">
        <Text dimColor={useColor} wrap="wrap">
          Runs the code-reviewer agent on changed files (inferential, slower
          than shell sensors). Applies to:{' '}
          {CODE_REVIEW_PRESET.appliesTo.join(', ')}
        </Text>
      </Box>
    );
  }
  const s = row.sensor;
  if (s.kind !== 'computational') {
    return (
      <Box flexDirection="column">
        <Text dimColor={useColor} wrap="wrap">
          Inferential sensor — no shell command to preview.
        </Text>
      </Box>
    );
  }
  const cmdLine = [s.command, ...s.args].join(' ').trim();
  return (
    <Box flexDirection="column">
      <Text bold>Command</Text>
      <Text wrap="wrap">{cmdLine.length > 0 ? cmdLine : '(no args)'}</Text>
    </Box>
  );
}

function SensorsWizardRoot(props: WizardRootProps): ReactNode {
  const useColor = props.colorMode === 'color';
  const size = useTerminalSize();
  const [phase, setPhase] = useState<WizardPhase>('intro');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialSelectedIds(props.initialSensors),
  );
  const [manualExtras, setManualExtras] = useState<SensorDefinition[]>(() =>
    initialManualExtras(props.initialSensors, props.candidates),
  );
  const [cursor, setCursor] = useState(0);
  const [manualStep, setManualStep] = useState<ManualStep>('id');
  const [bufId, setBufId] = useState('');
  const [bufCmd, setBufCmd] = useState('');
  const [bufArgs, setBufArgs] = useState('');

  const listRows = useMemo(
    () => buildListRows(props.candidates, manualExtras),
    [props.candidates, manualExtras],
  );

  useEffect(() => {
    if (listRows.length === 0) {
      return;
    }
    setCursor((c) => Math.min(Math.max(0, c), listRows.length - 1));
  }, [listRows.length]);

  const headerState: TuiHeaderState = {
    repoName: basename(props.repoRoot),
    branch: 'init · sensors',
    sprintIdx: null,
    totalSprints: null,
    contextPct: null,
    updateAvailable: false,
  };

  const finishIfValid = useCallback(() => {
    const sensors = buildOrderedSensors(listRows, new Set(selectedIds));
    const parsed = sensorsFileSchema.safeParse({
      concurrency: 4,
      sensors,
    });
    if (!parsed.success) {
      props.onAbort(parsed.error.message);
      return;
    }
    props.onDone(parsed.data);
  }, [props, listRows, selectedIds]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

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
          const parts =
            bufArgs.trim().length > 0 ? bufArgs.trim().split(/\s+/u) : [];
          const candConflict = props.candidates.some((c) => c.id === id);
          const manualConflict = manualExtras.some((s) => s.id === id);
          if (id === 'code-review' || candConflict || manualConflict) {
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
          const newRowIndex = props.candidates.length + 1 + manualExtras.length;
          setManualExtras((m) => [...m, sensor]);
          setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          setCursor(newRowIndex);
          setPhase('main');
          setManualStep('id');
          setBufId('');
          setBufCmd('');
          setBufArgs('');
          setCursor(listRows.length);
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
        if (input === 'm' || input === 'M') {
          setPhase('manual');
          setManualStep('id');
          setBufId('');
          setBufCmd('');
          setBufArgs('');
          return;
        }
        if (key.return) {
          if (selectedIds.length >= 1) {
            finishIfValid();
          }
          return;
        }
        // Ink 7 `useInput` does not set `key.space`; space is delivered as `input === ' '`.
        if (input === ' ') {
          const row = listRows[cursor];
          if (row === undefined) {
            return;
          }
          if (row.kind === 'candidate') {
            toggleId(row.c.id);
          } else if (row.kind === 'inferential') {
            toggleId('code-review');
          } else {
            toggleId(row.sensor.id);
          }
          return;
        }
        if (key.upArrow) {
          setCursor((c) => Math.max(0, c - 1));
          return;
        }
        if (key.downArrow) {
          setCursor((c) => Math.min(listRows.length - 1, c + 1));
          return;
        }
      }
    },
    {
      isActive: true,
    },
  );

  const llmWarningBlock =
    props.llmWarning !== undefined ? (
      <Box marginBottom={1}>
        <Text {...(useColor ? { color: 'yellow' } : {})} wrap="wrap">
          AI suggestions unavailable: {props.llmWarning}
        </Text>
      </Box>
    ) : null;

  const body = (() => {
    if (phase === 'intro') {
      return (
        <Box flexDirection="column" paddingX={1} width={size.columns}>
          <Box marginBottom={1}>
            <Text bold {...(useColor ? { color: 'cyan' } : {})}>
              Sensor setup (required)
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor={useColor} wrap="wrap">
              {INTRO}
            </Text>
          </Box>
          {llmWarningBlock}
          <Box marginTop={1}>
            <Text dimColor={useColor}>Enter continue · Ctrl+C cancel</Text>
          </Box>
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
        manualStep === 'id'
          ? bufId
          : manualStep === 'command'
            ? bufCmd
            : bufArgs;
      return (
        <Box flexDirection="column" paddingX={1} width={size.columns}>
          <Box marginBottom={1}>
            <Text bold {...(useColor ? { color: 'cyan' } : {})}>
              Manual sensor
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text dimColor={useColor} wrap="wrap">
              Esc back · Enter next / submit on args step
            </Text>
          </Box>
          <Text>
            {label}: {value}█
          </Text>
          <Box marginTop={1}>
            <Text dimColor={useColor}>
              Enter confirm step · Esc back to list
            </Text>
          </Box>
        </Box>
      );
    }

    const canFinish = selectedIds.length >= 1;
    const focusedRow = listRows[cursor];
    const selectedSet = new Set(selectedIds);

    const listBlock =
      listRows.length === 0 ? (
        <Text dimColor={useColor}>(no rows)</Text>
      ) : (
        listRows.map((row, i) => {
          const isFocus = i === cursor;
          let id: string;
          let tag: string;
          if (row.kind === 'candidate') {
            id = row.c.id;
            tag = `[${row.c.source}]`;
          } else if (row.kind === 'inferential') {
            id = 'code-review';
            tag = '[preset]';
          } else {
            id = row.sensor.id;
            tag = '[manual]';
          }
          const on = selectedSet.has(
            row.kind === 'inferential' ? 'code-review' : id,
          );
          const bullet = on ? BULLET_ON : BULLET_OFF;
          return (
            <Box key={`${id}-${String(i)}`} flexDirection="row" width="100%">
              <Text
                bold={isFocus}
                wrap="truncate"
                {...(useColor && isFocus ? { color: 'green' } : {})}
              >
                {isFocus ? '› ' : '  '}
                {bullet} {tag} {id}
              </Text>
            </Box>
          );
        })
      );

    return (
      <Box flexDirection="column" paddingX={1} width={size.columns}>
        <Box flexDirection="column" marginBottom={1}>
          <Text bold {...(useColor ? { color: 'cyan' } : {})}>
            Sensors
          </Text>
        </Box>
        {llmWarningBlock}
        {props.candidates.length === 0 && manualExtras.length === 0 ? (
          <Box marginBottom={1}>
            <Text dimColor={useColor} wrap="wrap">
              No scan suggestions — you can still select the inferential row or
              press m for a custom command.
            </Text>
          </Box>
        ) : null}
        <Box flexDirection="column" marginBottom={1} width="100%">
          {listBlock}
        </Box>
        <Box
          flexDirection="column"
          marginBottom={1}
          marginTop={1}
          paddingX={1}
          borderStyle="single"
          borderColor={useColor ? 'gray' : undefined}
          width="100%"
        >
          <Text bold {...(useColor ? { color: 'cyan' } : {})}>
            Selection detail
          </Text>
          <Box marginTop={1}>{focusDetailPanel(focusedRow, useColor)}</Box>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor={useColor} wrap="wrap">
            ↑↓ move · Space toggle · Enter finish
            {canFinish ? '' : ' (select at least one)'} · m custom sensor ·
            Ctrl+C cancel
          </Text>
        </Box>
      </Box>
    );
  })();

  return (
    <Box flexDirection="column" width="100%">
      <Header mode="idle" header={headerState} colorMode={props.colorMode} />
      {body}
    </Box>
  );
}

export type InitSensorsWizardResult =
  | {
      readonly kind: 'done';
      readonly sensorsFile: ReturnType<typeof sensorsFileSchema.parse>;
    }
  | { readonly kind: 'abort'; readonly message: string };

export async function runInitSensorsWizard(options: {
  readonly repoRoot: string;
  readonly candidates: readonly SensorInitCandidate[];
  readonly initialSensors: readonly SensorDefinition[];
  readonly llmWarning?: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<InitSensorsWizardResult> {
  const colorMode = resolveColorMode({
    args: [],
    env: options.env ?? process.env,
  });

  clearTerminalViewport();

  return await new Promise<InitSensorsWizardResult>((resolve) => {
    const app = render(
      createElement(SensorsWizardRoot, {
        repoRoot: options.repoRoot,
        colorMode,
        candidates: options.candidates,
        initialSensors: options.initialSensors,
        ...(options.llmWarning !== undefined
          ? { llmWarning: options.llmWarning }
          : {}),
        onDone: (sensorsFile) => {
          app.unmount();
          resolve({ kind: 'done', sensorsFile });
        },
        onAbort: (message) => {
          app.unmount();
          resolve({ kind: 'abort', message });
        },
      }),
      {
        exitOnCtrlC: false,
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
      },
    );
  });
}
