import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { formatAgentErrorForDisplay } from '@maestro/agents';
import type { MaestroEvent } from '@maestro/core';
import type { MaestroConfig } from '@maestro/config';
import {
  runComputationalDiscovery,
  runInferentialDiscovery,
  type ComputationalDiscoveryResult,
  type InferentialDiscoveryProgressStep,
} from '@maestro/discovery';
import {
  App,
  createInitialTuiState,
  createTuiStore,
  resolveColorMode,
} from '@maestro/tui';
import { render, type Instance } from 'ink';
import { createElement } from 'react';

import { CLI_PACKAGE_VERSION } from './cli-version.js';
import { createDiscoveryRunLog } from './discovery-debug-log.js';
import { resolveWorkspaceHeader } from './resolve-workspace-header.js';

function summarizeStructure(comp: ComputationalDiscoveryResult): string {
  const names = comp.structure.topLevelNames.slice(0, 10).join(', ');
  const topEx = Object.entries(comp.structure.extensionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ext, n]) => `${ext}:${String(n)}`)
    .join(' ');
  const th = comp.structure.testDirectoryHints.join(', ') || '—';
  return `entries: ${names} | ext: ${topEx} | test dirs: ${th}`;
}

function buildDiffSnippet(path: string, before: string, after: string): string {
  if (before === after) {
    return `--- ${path}\n(no changes)\n`;
  }
  const minus =
    before.length > 0 ? before.split('\n').map((l) => `-${l}`) : ['- '];
  const plus =
    after.length > 0 ? after.split('\n').map((l) => `+${l}`) : ['+ '];
  return [`--- ${path}`, ...minus, ...plus].join('\n');
}

/** Label for Discovery header after provider picker (wireframe B2). */
export function formatDiscoveryProviderSummary(config: MaestroConfig): string {
  const model = config.defaults.discovery.model;
  const slash = model.indexOf('/');
  const provider = slash >= 0 ? model.slice(0, slash) : model;
  return `${provider} · ${model}`;
}

function progressLabel(
  step: InferentialDiscoveryProgressStep,
  detail?: string,
): string {
  let base: string;
  switch (step) {
    case 'computational':
      base = 'Scanning stack & structure';
      break;
    case 'sampling':
      base = 'Sampling repository files';
      break;
    case 'llm':
      base = 'Running discovery agent (LLM)';
      break;
    default:
      base = 'Working…';
  }
  return detail ? `${base} · ${detail}` : base;
}

export type InitDiscoveryTuiResult =
  | {
      readonly ok: true;
      readonly choice: 'accept' | 'cancel';
      readonly docs: {
        readonly agentsMd: string;
        readonly architectureMd: string;
      };
    }
  | { readonly ok: false; readonly message: string };

export async function runInitDiscoveryTui(options: {
  readonly repoRoot: string;
  readonly config: MaestroConfig;
  readonly env?: NodeJS.ProcessEnv;
  /** Shown on DiscoveryScreen after interactive provider setup (B2). */
  readonly providerSummary?: string | null;
}): Promise<InitDiscoveryTuiResult> {
  const { repoRoot, config } = options;
  const env = options.env ?? process.env;
  const colorMode = resolveColorMode({ args: [], env });

  let ink: Instance | undefined;
  let pipelineFailed = false;
  let pipelineError = '';
  let lastDocs: {
    agentsMd: string;
    architectureMd: string;
  } | null = null;

  const discoveryLog = await createDiscoveryRunLog(repoRoot);
  const baseHeader = createInitialTuiState().header;
  const workspaceHeader = await resolveWorkspaceHeader(repoRoot);

  return await new Promise<InitDiscoveryTuiResult>((resolve) => {
    const baseDiscovery = createInitialTuiState().discovery;
    const store = createTuiStore({
      mode: 'discovery',
      colorMode,
      header: { ...baseHeader, ...workspaceHeader },
      discovery: {
        ...baseDiscovery,
        providerSummary: options.providerSummary ?? null,
      },
    });

    const finish = (result: InitDiscoveryTuiResult) => {
      ink?.unmount();
      ink = undefined;
      resolve(result);
    };

    ink = render(
      createElement(App, {
        store,
        colorMode,
        maestroVersion: CLI_PACKAGE_VERSION,
        discovery: {
          onChoice: (choice: 'accept' | 'cancel') => {
            if (pipelineFailed) {
              finish({ ok: false, message: pipelineError });
              return;
            }
            if (!lastDocs) {
              finish({
                ok: false,
                message: 'Discovery produced no output.',
              });
              return;
            }
            finish({ ok: true, choice, docs: lastDocs });
          },
        },
      }),
    );

    void (async () => {
      let streamBuf = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let llmChars = 0;
      let lastFileLogAt = 0;

      try {
        await discoveryLog.appendLine(`[phase] detecting`);
        store.setState((s) => ({
          ...s,
          discovery: {
            ...s.discovery,
            phase: 'detecting',
            logFilePath: discoveryLog.path,
          },
        }));
        const comp = await runComputationalDiscovery(repoRoot);
        const stackSummary = `${comp.stack.kind} · ${comp.stack.markers.join(' ')}`;
        await discoveryLog.appendLine(`[phase] structuring`);
        store.setState((s) => ({
          ...s,
          discovery: {
            ...s.discovery,
            phase: 'structuring',
            stackSummary,
            structureSummary: summarizeStructure(comp),
          },
        }));
        await discoveryLog.appendLine(`[phase] inferring (inferential)`);
        store.setState((s) => ({
          ...s,
          discovery: {
            ...s.discovery,
            phase: 'inferring',
            progressHint: progressLabel('computational'),
            agentStreamTail: '',
          },
        }));

        const scheduleStreamFlush = () => {
          if (flushTimer) {
            return;
          }
          flushTimer = setTimeout(() => {
            flushTimer = null;
            const tail = streamBuf.slice(-8000);
            store.setState((s) => ({
              ...s,
              discovery: { ...s.discovery, agentStreamTail: tail },
            }));
          }, 90);
        };

        const onMaestroEvent = (e: MaestroEvent) => {
          if (e.type === 'agent.delta') {
            streamBuf += e.chunk;
            llmChars += e.chunk.length;
            if (llmChars - lastFileLogAt >= 8000) {
              lastFileLogAt = llmChars;
              void discoveryLog.appendLine(
                `[llm] streamed ${String(llmChars)} characters so far`,
              );
            }
            scheduleStreamFlush();
            return;
          }
          if (e.type === 'agent.started') {
            void discoveryLog.appendLine(`[event] agent.started ${e.agentId}`);
            return;
          }
          if (e.type === 'agent.completed') {
            void discoveryLog.appendLine(
              `[event] agent.completed ${e.agentId} in ${String(e.durationMs)}ms`,
            );
            return;
          }
          if (e.type === 'agent.failed') {
            void discoveryLog.appendLine(
              `[event] agent.failed ${e.agentId}: ${e.error}`,
            );
          }
        };

        const docs = await runInferentialDiscovery({
          repoRoot,
          config,
          onProgress: (step, detail) => {
            store.setState((s) => ({
              ...s,
              discovery: {
                ...s.discovery,
                progressHint: progressLabel(step, detail),
              },
            }));
            void discoveryLog.appendLine(
              `[progress] ${step}${detail ? ` ${detail}` : ''}`,
            );
          },
          onMaestroEvent,
        });
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        await discoveryLog.appendLine(
          `[llm] stream finished (${String(llmChars)} chars)`,
        );

        lastDocs = docs;

        let agentsOld = '';
        let archOld = '';
        try {
          agentsOld = await readFile(
            join(repoRoot, '.maestro', 'AGENTS.md'),
            'utf8',
          );
        } catch {
          /* empty */
        }
        try {
          archOld = await readFile(
            join(repoRoot, '.maestro', 'ARCHITECTURE.md'),
            'utf8',
          );
        } catch {
          /* empty */
        }

        const diffAgents = buildDiffSnippet(
          '.maestro/AGENTS.md',
          agentsOld,
          docs.agentsMd,
        );
        const diffArch = buildDiffSnippet(
          '.maestro/ARCHITECTURE.md',
          archOld,
          docs.architectureMd,
        );

        store.setState((s) => ({
          ...s,
          discovery: {
            ...s.discovery,
            phase: 'preview',
            errorSummary: null,
            errorDetail: null,
            progressHint: null,
            agentStreamTail: null,
            proposedAgentsMd: docs.agentsMd,
            proposedArchitectureMd: docs.architectureMd,
          },
          diffPreview: {
            ...s.diffPreview,
            mode: 'diff',
            activePath: '.maestro/AGENTS.md',
            unifiedDiff: diffAgents,
            changedPaths: ['.maestro/AGENTS.md', '.maestro/ARCHITECTURE.md'],
            activeIndex: 0,
            diffByPath: {
              '.maestro/AGENTS.md': diffAgents,
              '.maestro/ARCHITECTURE.md': diffArch,
            },
          },
        }));
        await discoveryLog.appendLine(`[phase] preview (success)`);
      } catch (error) {
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        pipelineFailed = true;
        await discoveryLog.appendException(error);
        const formatted = formatAgentErrorForDisplay(error);
        pipelineError = [
          formatted.summary,
          formatted.detail,
          `Full diagnostic log: ${discoveryLog.path}`,
        ].join('\n\n');
        store.setState((s) => ({
          ...s,
          discovery: {
            ...s.discovery,
            phase: 'error',
            errorSummary: formatted.summary,
            errorDetail: formatted.detail,
            logFilePath: discoveryLog.path,
            progressHint: null,
            agentStreamTail: streamBuf ? streamBuf.slice(-8000) : null,
          },
        }));
      }
    })();
  });
}
