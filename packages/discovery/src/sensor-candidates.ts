import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import type { MaestroConfig } from '@maestro/config';
import { createEventBus } from '@maestro/core';
import {
  runAgent,
  sensorSetupAgent,
  type SensorSetupAgentInput,
} from '@maestro/agents';
import { getModel } from '@maestro/provider';

import { runComputationalDiscovery } from './computational.js';
import type { ComputationalDiscoveryResult, StackKind } from './types.js';

export type SensorInitCandidateSource = 'heuristic' | 'catalog' | 'llm';

export type SensorInitCandidate = {
  readonly id: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly onFail: 'block' | 'warn';
  readonly rationale: string;
  readonly source: SensorInitCandidateSource;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merges layers left to right: first occurrence of each `id` wins.
 * Pass highest-priority layer first (LLM, then heuristic, then catalog).
 */
export function mergeSensorCandidateLayers(
  layers: readonly SensorInitCandidate[][],
): SensorInitCandidate[] {
  const map = new Map<string, SensorInitCandidate>();
  for (const layer of layers) {
    for (const c of layer) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    }
  }
  return [...map.values()];
}

function pmRunCommand(
  pm: string | undefined,
  scriptName: string,
): { command: string; args: string[] } {
  const p = pm ?? 'npm';
  if (p === 'pnpm') {
    return { command: 'pnpm', args: ['run', scriptName] };
  }
  if (p === 'yarn') {
    return { command: 'yarn', args: [scriptName] };
  }
  return { command: 'npm', args: ['run', scriptName] };
}

const SCRIPT_KEYS = [
  'test',
  'lint',
  'typecheck',
  'check',
  'build',
] as const;

export async function buildHeuristicSensorCandidates(
  repoRoot: string,
  computational: ComputationalDiscoveryResult,
): Promise<SensorInitCandidate[]> {
  const { stack } = computational;
  const out: SensorInitCandidate[] = [];

  const pushScriptIfPresent = (
    scripts: Record<string, string>,
    key: (typeof SCRIPT_KEYS)[number],
  ) => {
    if (scripts[key] === undefined) {
      return;
    }
    const { command, args } = pmRunCommand(
      stack.hints.packageManager as string | undefined,
      key,
    );
    out.push({
      id: key,
      command,
      args,
      onFail: key === 'build' ? 'warn' : 'block',
      rationale:
        key === 'build'
          ? 'Build may be slow or flaky in dev environments; still useful as a harness signal.'
          : `Runs the package.json "${key}" script via the detected package manager.`,
      source: 'heuristic',
    });
  };

  if (stack.kind === 'node' || stack.kind === 'node-ts') {
    const raw = await readFile(join(repoRoot, 'package.json'), 'utf8').catch(
      () => null,
    );
    if (raw !== null) {
      try {
        const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
        const scripts = pkg.scripts ?? {};
        for (const key of SCRIPT_KEYS) {
          pushScriptIfPresent(scripts, key);
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (stack.kind === 'rust') {
    out.push({
      id: 'cargo-test',
      command: 'cargo',
      args: ['test'],
      onFail: 'block',
      rationale: 'Rust unit and integration tests via Cargo.',
      source: 'heuristic',
    });
    out.push({
      id: 'cargo-clippy',
      command: 'cargo',
      args: ['clippy', '--', '-D', 'warnings'],
      onFail: 'warn',
      rationale: 'Clippy may require extra setup; strong static feedback when available.',
      source: 'heuristic',
    });
  }

  if (stack.kind === 'go') {
    out.push({
      id: 'go-test',
      command: 'go',
      args: ['test', './...'],
      onFail: 'block',
      rationale: 'Runs all Go tests from the module root.',
      source: 'heuristic',
    });
  }

  if (stack.kind === 'python') {
    const pm = stack.hints.packageManager;
    if (pm === 'uv') {
      out.push({
        id: 'pytest',
        command: 'uv',
        args: ['run', 'pytest'],
        onFail: 'block',
        rationale: 'Runs tests through uv when the project uses it.',
        source: 'heuristic',
      });
    } else {
      out.push({
        id: 'pytest',
        command: 'pytest',
        args: [],
        onFail: 'block',
        rationale: 'Standard Python test runner when available.',
        source: 'heuristic',
      });
    }
    out.push({
      id: 'ruff-check',
      command: 'ruff',
      args: ['check', '.'],
      onFail: 'warn',
      rationale: 'Ruff linter; optional if not installed in the environment.',
      source: 'heuristic',
    });
  }

  if (stack.kind === 'ruby') {
    out.push({
      id: 'bundle-exec-rake-test',
      command: 'bundle',
      args: ['exec', 'rake', 'test'],
      onFail: 'warn',
      rationale: 'Common Ruby test entrypoint when Rake is configured.',
      source: 'heuristic',
    });
  }

  if (stack.kind === 'java') {
    const fw = stack.hints.framework;
    if (fw === 'maven') {
      out.push({
        id: 'mvn-test',
        command: 'mvn',
        args: ['-q', 'test'],
        onFail: 'block',
        rationale: 'Maven test phase for Java projects.',
        source: 'heuristic',
      });
    } else if (fw === 'gradle') {
      const gradlew = join(repoRoot, 'gradlew');
      if (await pathExists(gradlew)) {
        out.push({
          id: 'gradle-test',
          command: join(repoRoot, 'gradlew'),
          args: ['test'],
          onFail: 'block',
          rationale: 'Gradle wrapper test task.',
          source: 'heuristic',
        });
      } else {
        out.push({
          id: 'gradle-test',
          command: 'gradle',
          args: ['test'],
          onFail: 'warn',
          rationale: 'Gradle test task; requires Gradle on PATH if no wrapper.',
          source: 'heuristic',
        });
      }
    }
  }

  return out;
}

export function buildCatalogSensorCandidates(
  _stackKind: StackKind,
): SensorInitCandidate[] {
  return [
    {
      id: 'snyk-test',
      command: 'snyk',
      args: ['test'],
      onFail: 'warn',
      rationale:
        'Optional dependency/security scan; requires Snyk CLI and authentication.',
      source: 'catalog',
    },
    {
      id: 'sonar-scanner',
      command: 'sonar-scanner',
      args: [],
      onFail: 'warn',
      rationale:
        'Optional SonarQube analysis; requires scanner binary and server/project configuration.',
      source: 'catalog',
    },
    {
      id: 'semgrep-auto',
      command: 'semgrep',
      args: ['--config', 'auto'],
      onFail: 'warn',
      rationale:
        'Optional static analysis; requires semgrep CLI and may be slow on large trees.',
      source: 'catalog',
    },
  ];
}

async function readPackageScriptsJson(repoRoot: string): Promise<string | null> {
  const raw = await readFile(join(repoRoot, 'package.json'), 'utf8').catch(
    () => null,
  );
  if (raw === null) {
    return null;
  }
  try {
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return JSON.stringify(pkg.scripts ?? {}, null, 2);
  } catch {
    return null;
  }
}

function buildSensorSetupAgentInput(
  repoRoot: string,
  computational: ComputationalDiscoveryResult,
  heuristic: readonly SensorInitCandidate[],
  packageJsonScriptsJson: string | null,
): SensorSetupAgentInput {
  const lines = heuristic.map(
    (h) =>
      `- ${h.id}: ${h.command} ${h.args.join(' ')} (onFail=${h.onFail}) — ${h.rationale}`,
  );
  return {
    repoRoot,
    stackKind: computational.stack.kind,
    stackMarkers: [...computational.stack.markers],
    stackHintsJson: JSON.stringify(computational.stack.hints, null, 2),
    topLevelNames: [...computational.structure.topLevelNames],
    packageJsonScriptsJson,
    heuristicSummary: lines.join('\n') || '(no heuristic candidates)',
  };
}

export type RunSensorCandidateInferenceOptions = {
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  /** When false, skip the LLM and return heuristic + catalog only. */
  readonly useLlm: boolean;
};

export type RunSensorCandidateInferenceResult = {
  readonly computational: ComputationalDiscoveryResult;
  readonly candidates: SensorInitCandidate[];
  /** Set when useLlm was true but the LLM pass failed; heuristic + catalog are still returned. */
  readonly llmWarning?: string;
};

/**
 * Stack scan + heuristic/catalog sensor suggestions, optionally merged with an LLM pass.
 * Uses `defaults.discovery.model` so `maestro init` reuses the discovery model (and provider
 * credentials) chosen in the per-agent model wizard immediately before this step.
 */
export async function runSensorCandidateInference(
  options: RunSensorCandidateInferenceOptions,
): Promise<RunSensorCandidateInferenceResult> {
  const computational = await runComputationalDiscovery(options.repoRoot);
  const heuristic = await buildHeuristicSensorCandidates(
    options.repoRoot,
    computational,
  );
  const catalog = buildCatalogSensorCandidates(computational.stack.kind);
  const scriptsJson = await readPackageScriptsJson(options.repoRoot);

  const llmLayer: SensorInitCandidate[] = [];
  let llmWarning: string | undefined;

  if (options.useLlm) {
    try {
      const bus = createEventBus();
      const input = buildSensorSetupAgentInput(
        options.repoRoot,
        computational,
        heuristic,
        scriptsJson,
      );
      const modelRef = options.config.defaults.discovery.model;
      const model = getModel(modelRef, {
        config: options.config,
      });
      const { output } = await runAgent({
        definition: sensorSetupAgent,
        input,
        context: {
          agentId: 'sensor-setup',
          runId: 'sensor-candidates',
          workingDir: options.repoRoot,
          metadata: {},
        },
        bus,
        config: options.config,
        model,
      });
      llmLayer.push(
        ...output.candidates.map((c) => ({
          id: c.id,
          command: c.command,
          args: c.args,
          ...(c.cwd != null && c.cwd.length > 0 ? { cwd: c.cwd } : {}),
          onFail: c.onFail,
          rationale:
            c.rationale.length > 0 ? c.rationale : 'Model-suggested sensor.',
          source: 'llm' as const,
        })),
      );
    } catch (e) {
      llmWarning =
        e instanceof Error ? e.message : `LLM sensor discovery failed: ${String(e)}`;
    }
  }

  const candidates = mergeSensorCandidateLayers([llmLayer, heuristic, catalog]);

  return {
    computational,
    candidates,
    ...(llmWarning !== undefined ? { llmWarning } : {}),
  };
}
