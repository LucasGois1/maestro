import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_CONFIG } from '@maestro/config';
import { createKBManager, lintKnowledgeBase } from '@maestro/kb';
import type * as AgentsModule from '@maestro/agents';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { applyDiscoveryToKb } from './apply-draft.js';
import { runInferentialDiscovery } from './orchestrator.js';

const VALID_AGENTS = `# AGENTS

## Header
Project: test
Stack: python
Version: 0

## Repo Map
- src/

## Docs
- [ARCHITECTURE.md](./ARCHITECTURE.md)

## Essential Commands
- install: pip install
- test: pytest
- build:
- run:

## Critical Conventions
- one

## Escalation Path
- ask human
`;

const VALID_ARCH = `# ARCHITECTURE

## Bird's Eye View
Test system.

## Code Map
src owns app code.

## Cross-Cutting Concerns
None.

## Module Boundaries
Clean.

## Data Flow
Request in, response out.
`;

vi.mock('@maestro/agents', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentsModule>();
  return {
    ...actual,
    runAgent: vi.fn(async () => ({
      output: {
        agentsMd: VALID_AGENTS,
        architectureMd: VALID_ARCH,
      },
      text: '',
      durationMs: 0,
    })),
  };
});

describe('runInferentialDiscovery (mocked agent)', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'maestro-disc-int-'));
    await mkdir(join(repoRoot, 'src'), { recursive: true });
    await writeFile(
      join(repoRoot, 'pyproject.toml'),
      '[project]\nname = "demo"\nversion = "0.1.0"\n',
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'src', 'app.py'),
      'def main():\n  pass\n',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('writes KB output that passes lint for a Python fixture', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    const docs = await runInferentialDiscovery({
      repoRoot,
      config: DEFAULT_CONFIG,
      runId: 'integration-test',
    });

    expect(docs.agentsMd).toContain('## Header');
    expect(docs.architectureMd).toContain('## Bird');

    await applyDiscoveryToKb(repoRoot, docs);

    const report = await lintKnowledgeBase({ repoRoot });
    expect(report.ok).toBe(true);
  });
});

describe('runInferentialDiscovery Node fixture (mocked agent)', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'maestro-disc-node-'));
    await writeFile(
      join(repoRoot, 'package.json'),
      JSON.stringify({ name: 'demo', version: '1.0.0' }),
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'index.ts'),
      'export const x = 1;\n',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('passes lint after apply for a minimal Node repo', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    const docs = await runInferentialDiscovery({
      repoRoot,
      config: DEFAULT_CONFIG,
      runId: 'integration-node',
    });
    await applyDiscoveryToKb(repoRoot, docs);

    const report = await lintKnowledgeBase({ repoRoot });
    expect(report.ok).toBe(true);
  });
});

describe('runInferentialDiscovery Go fixture (mocked agent)', () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'maestro-disc-go-'));
    await writeFile(
      join(repoRoot, 'go.mod'),
      'module example.com/demo\n\ngo 1.22\n',
      'utf8',
    );
    await writeFile(
      join(repoRoot, 'main.go'),
      'package main\nfunc main() {}\n',
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  it('passes lint after apply for a minimal Go module', async () => {
    const kb = createKBManager({ repoRoot });
    await kb.init();

    const docs = await runInferentialDiscovery({
      repoRoot,
      config: DEFAULT_CONFIG,
      runId: 'integration-go',
    });
    await applyDiscoveryToKb(repoRoot, docs);

    const report = await lintKnowledgeBase({ repoRoot });
    expect(report.ok).toBe(true);
  });
});
