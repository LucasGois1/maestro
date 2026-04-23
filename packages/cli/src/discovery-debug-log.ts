import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { AgentOutputParseError, AgentValidationError } from '@maestro/agents';

function stamp(): string {
  return new Date().toISOString();
}

export type DiscoveryRunLog = {
  readonly path: string;
  readonly appendLine: (line: string) => Promise<void>;
  readonly appendException: (error: unknown) => Promise<void>;
};

export async function createDiscoveryRunLog(
  repoRoot: string,
): Promise<DiscoveryRunLog> {
  const dir = join(repoRoot, '.maestro', 'logs');
  await mkdir(dir, { recursive: true });
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(dir, `discovery-${id}.log`);

  const appendLine = async (line: string) => {
    await appendFile(path, `${line}\n`, 'utf8');
  };

  await appendLine(`[${stamp()}] Maestro discovery session started`);

  return {
    path,
    appendLine,
    appendException: async (error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      await appendLine(`[${stamp()}] EXCEPTION ${err.name}: ${err.message}`);
      if (err.stack) {
        await appendLine(err.stack);
      }
      if (error instanceof AgentValidationError && error.rawModelOutput) {
        await appendLine('--- full model output (validation failed) ---');
        await appendLine(error.rawModelOutput);
      }
      if (error instanceof AgentOutputParseError) {
        await appendLine('--- full model output (structured output / parse failed) ---');
        await appendLine(error.rawText);
      }
    },
  };
}
