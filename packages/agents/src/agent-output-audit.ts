import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { GenerateTextResult, ToolSet } from 'ai';

import type { AgentContext } from './definition.js';

const STAMP = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');

function resolveMaestroDir(metadata: Readonly<Record<string, unknown>>): string {
  const raw = metadata.maestroDir;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return '.maestro';
}

export type GenerateTextAuditModel = {
  readonly finishReason: string;
  readonly textLength: number;
  readonly steps: ReadonlyArray<{
    readonly stepNumber: number;
    readonly textLength: number;
    readonly textPreview: string;
    readonly finishReason: string;
    readonly toolNames: readonly string[];
  }>;
  readonly responseMessageRoles: readonly string[];
};

export function buildGenerateTextAuditModel(gen: {
  readonly text: string;
  readonly finishReason: string;
  readonly steps: ReadonlyArray<{
    readonly stepNumber: number;
    readonly text: string;
    readonly finishReason: string;
    readonly toolCalls: ReadonlyArray<{ readonly toolName: string }>;
  }>;
  readonly response: { readonly messages: ReadonlyArray<{ readonly role: string }> };
}): GenerateTextAuditModel {
  return {
    finishReason: gen.finishReason,
    textLength: gen.text.length,
    steps: gen.steps.map((s) => ({
      stepNumber: s.stepNumber,
      textLength: s.text.length,
      textPreview: s.text.length > 4_000 ? `${s.text.slice(0, 4_000)}…` : s.text,
      finishReason: s.finishReason,
      toolNames: s.toolCalls.map((t) => t.toolName),
    })),
    responseMessageRoles: gen.response.messages.map((m) => m.role),
  };
}

/** Snapshot of a `generateText` tool loop for parse-failure audits. */
export function serializeGenerateTextForAudit(
  gen: GenerateTextResult<ToolSet, never>,
): GenerateTextAuditModel {
  return buildGenerateTextAuditModel({
    text: gen.text,
    finishReason: String(gen.finishReason),
    steps: gen.steps.map((s) => ({
      stepNumber: s.stepNumber,
      text: s.text,
      finishReason: String(s.finishReason),
      toolCalls: s.toolCalls.map((tc) => ({ toolName: tc.toolName })),
    })),
    response: {
      messages: gen.response.messages.map((m) => ({
        role: String(m.role),
      })),
    },
  });
}

export type WriteAgentParseAuditOptions = {
  readonly context: AgentContext;
  readonly agentId: string;
  readonly candidateText: string;
  readonly parseMessage: string;
  readonly generateTextAudit: GenerateTextAuditModel;
};

/**
 * Writes JSON under `<repo>/.maestro/runs/<runId>/logs/` (or `metadata.maestroDir`).
 * Never throws — failures are swallowed so agent errors stay primary.
 */
export async function writeAgentParseAuditLog(
  options: WriteAgentParseAuditOptions,
): Promise<string | undefined> {
  try {
    const maestroDir = resolveMaestroDir(options.context.metadata);
    const dir = join(
      options.context.workingDir,
      maestroDir,
      'runs',
      options.context.runId,
      'logs',
    );
    await mkdir(dir, { recursive: true });
    const fileName = `agent-${options.agentId}-parse-${STAMP()}.json`;
    const path = join(dir, fileName);
    const payload = {
      writtenAt: new Date().toISOString(),
      agentId: options.agentId,
      runId: options.context.runId,
      parseMessage: options.parseMessage,
      candidateTextLength: options.candidateText.length,
      candidateTextPreview:
        options.candidateText.length > 12_000
          ? `${options.candidateText.slice(0, 12_000)}…`
          : options.candidateText,
      generateText: options.generateTextAudit,
    };
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return path;
  } catch {
    return undefined;
  }
}
