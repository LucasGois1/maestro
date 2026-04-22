import {
  AGENT_NAMES,
  type AgentName,
  configSchema,
  deepMergeAll,
  type MaestroConfig,
  type MaestroConfigInput,
  PROVIDER_NAMES,
  type ProviderName,
  providerCredentialEnvVar,
  readConfigFile,
  resolveConfigPaths,
  writeConfigFile,
} from '@maestro/config';
import {
  canUseProviderForInference,
  initPickerChoicesFor,
  loadConfigWithAutoResolvedModels,
} from '@maestro/provider';
import {
  Header,
  ListPickerScreen,
  resolveColorMode,
  type TuiColorMode,
  type TuiHeaderState,
} from '@maestro/tui';
import { Box, Text, render, useInput } from 'ink';
import { basename } from 'node:path';
import { createElement, useCallback, useRef, useState } from 'react';

const MODEL_PICKER_BACK_KEY = '__back__';

function agentAt(index: number): AgentName {
  const name = AGENT_NAMES[index];
  if (name === undefined) {
    throw new Error(`Invalid agent index: ${index}`);
  }
  return name;
}

const AGENT_LABEL: Record<AgentName, string> = {
  planner: 'Planner',
  architect: 'Architect',
  generator: 'Generator',
  evaluator: 'Evaluator',
  merger: 'Merger',
  'code-reviewer': 'Code reviewer',
  'doc-gardener': 'Doc gardener',
  discovery: 'Discovery',
};

function providerLabel(provider: ProviderName): string {
  switch (provider) {
    case 'anthropic':
      return 'Anthropic (Claude)';
    case 'openai':
      return 'OpenAI';
    case 'google':
      return 'Google (Gemini)';
    case 'ollama':
      return 'Ollama (local)';
    default:
      return provider;
  }
}

export type InitModelSetupResult =
  | { readonly kind: 'done'; readonly wroteFile: boolean }
  | { readonly kind: 'abort'; readonly message: string };

export async function mergeWriteProjectConfig(
  repoRoot: string,
  patch: MaestroConfigInput,
): Promise<void> {
  const { project } = resolveConfigPaths({ cwd: repoRoot });
  const onDisk = (await readConfigFile(project)) ?? {};
  const scaffold = configSchema.parse({}) as MaestroConfigInput;
  const merged = deepMergeAll<MaestroConfigInput>({}, scaffold, onDisk, patch);
  const parsed = configSchema.safeParse(merged);
  if (!parsed.success) {
    throw new Error(
      `Invalid .maestro/config.json after merge: ${parsed.error.message}`,
    );
  }
  await writeConfigFile(project, parsed.data as MaestroConfigInput);
}

type WizardPanel =
  | { readonly kind: 'provider'; readonly agentIdx: number }
  | {
      readonly kind: 'model';
      readonly agentIdx: number;
      readonly provider: ProviderName;
    }
  | {
      readonly kind: 'credYesNo';
      readonly agentIdx: number;
      readonly provider: ProviderName;
      readonly modelRef: string;
    }
  | {
      readonly kind: 'credPaste';
      readonly agentIdx: number;
      readonly provider: ProviderName;
      readonly modelRef: string;
    };

type InitModelWizardRootProps = {
  readonly repoRoot: string;
  readonly baseMerged: MaestroConfigInput;
  readonly colorMode: TuiColorMode;
  readonly onFinish: (result: InitModelSetupResult) => void;
};

function InitModelWizardRoot(props: InitModelWizardRootProps) {
  const accRef = useRef<MaestroConfigInput>({});
  const promptedRef = useRef(new Set<ProviderName>());
  const [panel, setPanel] = useState<WizardPanel>({ kind: 'provider', agentIdx: 0 });

  const effectiveConfig = useCallback(
    (): MaestroConfig =>
      configSchema.parse(
        deepMergeAll<MaestroConfigInput>({}, props.baseMerged, accRef.current),
      ),
    [props.baseMerged],
  );

  const headerState: TuiHeaderState = {
    repoName: basename(props.repoRoot),
    branch: 'init · models',
    sprintIdx: null,
    totalSprints: null,
    contextPct: null,
    updateAvailable: false,
  };

  const finishWizard = useCallback(
    (acc: MaestroConfigInput) => {
      const hasPatch =
        acc.defaults !== undefined ||
        acc.providers !== undefined ||
        acc.version !== undefined;
      if (!hasPatch) {
        props.onFinish({ kind: 'done', wroteFile: false });
        return;
      }
      void mergeWriteProjectConfig(props.repoRoot, acc).then(
        () => {
          props.onFinish({ kind: 'done', wroteFile: true });
        },
        (error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : typeof error === 'string'
                ? error
                : JSON.stringify(error);
          props.onFinish({ kind: 'abort', message });
        },
      );
    },
    [props],
  );

  const commitAgentModelAndAdvance = useCallback(
    (agentIdx: number, modelRef: string) => {
      accRef.current = deepMergeAll<MaestroConfigInput>({}, accRef.current, {
        defaults: {
          [agentAt(agentIdx)]: { model: modelRef },
        },
      });
      const nextIdx = agentIdx + 1;
      if (nextIdx >= AGENT_NAMES.length) {
        finishWizard(accRef.current);
        return;
      }
      setPanel({ kind: 'provider', agentIdx: nextIdx });
    },
    [finishWizard],
  );

  const afterCredentialStep = useCallback(
    (agentIdx: number, provider: ProviderName, modelRef: string) => {
      promptedRef.current.add(provider);
      commitAgentModelAndAdvance(agentIdx, modelRef);
    },
    [commitAgentModelAndAdvance],
  );

  const onModelPick = useCallback(
    (agentIdx: number, provider: ProviderName, itemKey: string) => {
      if (itemKey === MODEL_PICKER_BACK_KEY) {
        setPanel({ kind: 'provider', agentIdx });
        return;
      }
      const modelRef = itemKey;
      if (!promptedRef.current.has(provider)) {
        if (canUseProviderForInference(effectiveConfig(), provider)) {
          promptedRef.current.add(provider);
          commitAgentModelAndAdvance(agentIdx, modelRef);
          return;
        }
        setPanel({
          kind: 'credYesNo',
          agentIdx,
          provider,
          modelRef,
        });
        return;
      }
      commitAgentModelAndAdvance(agentIdx, modelRef);
    },
    [commitAgentModelAndAdvance, effectiveConfig],
  );

  const onProviderPick = useCallback((agentIdx: number, itemKey: string) => {
    setPanel({
      kind: 'model',
      agentIdx,
      provider: itemKey as ProviderName,
    });
  }, []);

  const body = (() => {
    if (panel.kind === 'provider') {
      const agent = agentAt(panel.agentIdx);
      return (
        <ListPickerScreen
          title={`Agent: ${AGENT_LABEL[agent]}`}
          description={
            panel.agentIdx === 0
              ? 'Choose the inference provider and model for each agent. Non-interactive terminals and --no-ai skip this step.'
              : 'Inference provider for this agent.'
          }
          items={PROVIDER_NAMES.map((p) => ({
            key: p,
            title: providerLabel(p),
          }))}
          colorMode={props.colorMode}
          onConfirm={(item) => {
            onProviderPick(panel.agentIdx, item.key);
          }}
        />
      );
    }
    if (panel.kind === 'model') {
      const agent = agentAt(panel.agentIdx);
      const choices = initPickerChoicesFor(panel.provider);
      return (
        <ListPickerScreen
          title={`Model — ${AGENT_LABEL[agent]}`}
          description={`Provider: ${providerLabel(panel.provider)}. The first row returns to the provider list.`}
          items={[
            {
              key: MODEL_PICKER_BACK_KEY,
              title: '← Back (choose another provider)',
            },
            ...choices.map((c) => ({
              key: c.ref,
              title: c.label,
              subtitle: c.ref,
            })),
          ]}
          initialIndex={1}
          colorMode={props.colorMode}
          onConfirm={(item) => {
            onModelPick(panel.agentIdx, panel.provider, item.key);
          }}
        />
      );
    }
    if (panel.kind === 'credYesNo') {
      const envVar = providerCredentialEnvVar(panel.provider);
      const intro =
        panel.provider === 'ollama'
          ? `Set \`${envVar}\` for a custom endpoint (default is http://localhost:11434).`
          : `This provider needs credentials. Set \`${envVar}\` in your environment, or paste an API key to store in .maestro/config.json.`;
      return (
        <ListPickerScreen
          title={`Credentials — ${providerLabel(panel.provider)}`}
          description={intro}
          items={[
            { key: 'yes', title: 'Yes, paste key / value now' },
            { key: 'no', title: 'No, I will configure later' },
          ]}
          colorMode={props.colorMode}
          onConfirm={(item) => {
            if (item.key === 'yes') {
              setPanel({
                kind: 'credPaste',
                agentIdx: panel.agentIdx,
                provider: panel.provider,
                modelRef: panel.modelRef,
              });
              return;
            }
            afterCredentialStep(
              panel.agentIdx,
              panel.provider,
              panel.modelRef,
            );
          }}
        />
      );
    }
    const p = panel;
    return (
      <MaskedSecretPasteStep
        provider={p.provider}
        colorMode={props.colorMode}
        onDone={(secret) => {
          const trimmed = secret.trim();
          if (trimmed.length > 0) {
            if (p.provider === 'ollama') {
              accRef.current = deepMergeAll<MaestroConfigInput>(
                {},
                accRef.current,
                { providers: { ollama: { baseUrl: trimmed } } },
              );
            } else {
              accRef.current = deepMergeAll<MaestroConfigInput>(
                {},
                accRef.current,
                { providers: { [p.provider]: { apiKey: trimmed } } },
              );
            }
          }
          afterCredentialStep(p.agentIdx, p.provider, p.modelRef);
        }}
      />
    );
  })();

  return (
    <Box flexDirection="column" width="100%">
      <Header mode="idle" header={headerState} colorMode={props.colorMode} />
      {body}
    </Box>
  );
}

type MaskedPasteProps = {
  readonly provider: ProviderName;
  readonly colorMode: TuiColorMode;
  readonly onDone: (secret: string) => void;
};

function MaskedSecretPasteStep(props: MaskedPasteProps) {
  const useColor = props.colorMode === 'color';
  const [value, setValue] = useState('');
  useInput(
    (input, key) => {
      if (key.return) {
        props.onDone(value);
        return;
      }
      if (input === 'q' || input === 'Q' || key.escape) {
        props.onDone('');
        return;
      }
      if (key.backspace || key.delete) {
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (
        input?.length === 1 &&
        !key.ctrl &&
        !key.meta &&
        (input >= ' ' || input === '\t')
      ) {
        setValue((v) => v + input);
      }
    },
    { isActive: true },
  );
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold {...(useColor ? { color: 'cyan' } : {})}>
        {props.provider === 'ollama' ? 'Paste base URL' : 'Paste API key'}
      </Text>
      <Text dimColor={useColor} wrap="wrap">
        {props.provider === 'ollama'
          ? 'Example: http://127.0.0.1:11434'
          : 'Input is masked; avoid shared screens when pasting secrets.'}
      </Text>
      <Text>Input: {'*'.repeat(value.length)}</Text>
      <Text dimColor={useColor}>
        Enter to confirm · Esc or Q to skip (empty)
      </Text>
    </Box>
  );
}

/**
 * Interactive `maestro init` step: pick provider and one of three curated models
 * per agent (including discovery), optionally persist API keys to `.maestro/config.json`.
 * Uses a single Ink tree (header + pickers) so the terminal updates in place.
 */
export async function runInitModelSetupInk(options: {
  readonly repoRoot: string;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<InitModelSetupResult> {
  const env = options.env ?? process.env;
  const colorMode = resolveColorMode({ args: [], env });
  const base = await loadConfigWithAutoResolvedModels({
    cwd: options.repoRoot,
    ...(options.env === undefined ? {} : { env: options.env }),
  });

  return await new Promise<InitModelSetupResult>((resolve) => {
    let ink: ReturnType<typeof render> | undefined;
    ink = render(
      createElement(InitModelWizardRoot, {
        repoRoot: options.repoRoot,
        baseMerged: base.merged,
        colorMode,
        onFinish: (result) => {
          ink?.unmount();
          ink = undefined;
          resolve(result);
        },
      }),
      {
        interactive: Boolean(process.stdin.isTTY && process.stdout.isTTY),
      },
    );
  });
}
