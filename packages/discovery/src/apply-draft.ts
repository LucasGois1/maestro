import { createKBManager } from '@maestro/kb';

export async function writeDiscoveryDraft(
  repoRoot: string,
  docs: { readonly agentsMd: string; readonly architectureMd: string },
): Promise<void> {
  const kb = createKBManager({ repoRoot });
  await kb.write('.discovery-draft/AGENTS.md', docs.agentsMd);
  await kb.write('.discovery-draft/ARCHITECTURE.md', docs.architectureMd);
}

export async function applyDiscoveryToKb(
  repoRoot: string,
  docs: { readonly agentsMd: string; readonly architectureMd: string },
): Promise<void> {
  const kb = createKBManager({ repoRoot });
  await kb.write('AGENTS.md', docs.agentsMd);
  await kb.write('ARCHITECTURE.md', docs.architectureMd);
}
