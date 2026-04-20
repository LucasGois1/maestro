import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAgentRegistry } from './registry.js';
import { AgentLoaderError, loadCustomAgents } from './loader.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'maestro-agents-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeAgentFile(name: string, source: string) {
  await writeFile(join(dir, name), source, 'utf8');
}

describe('loadCustomAgents', () => {
  it('returns [] when the directory does not exist', async () => {
    const registry = createAgentRegistry();
    const loaded = await loadCustomAgents(join(dir, 'missing'), registry);
    expect(loaded).toEqual([]);
  });

  it('loads a .mjs agent exported as default', async () => {
    await writeAgentFile(
      'my-agent.mjs',
      `
import { z } from 'zod';
export default {
  id: 'my-agent',
  role: 'sensor',
  systemPrompt: 'hi',
  inputSchema: z.any(),
  outputSchema: z.any(),
};
`,
    );
    const registry = createAgentRegistry();
    const loaded = await loadCustomAgents(dir, registry);
    expect(loaded.map((d) => d.id)).toEqual(['my-agent']);
    expect(registry.has('my-agent')).toBe(true);
  });

  it('wraps registry errors into AgentLoaderError', async () => {
    await writeAgentFile(
      'bad.mjs',
      `
import { z } from 'zod';
export default {
  id: 'bad',
  role: 'pipeline',
  systemPrompt: 'hi',
  inputSchema: z.any(),
  outputSchema: z.any(),
};
`,
    );
    const registry = createAgentRegistry();
    await expect(loadCustomAgents(dir, registry)).rejects.toBeInstanceOf(
      AgentLoaderError,
    );
  });

  it('throws AgentLoaderError when no agent export is found', async () => {
    await writeAgentFile('noop.mjs', 'export const something = 1;\n');
    const registry = createAgentRegistry();
    await expect(loadCustomAgents(dir, registry)).rejects.toBeInstanceOf(
      AgentLoaderError,
    );
  });
});
