/**
 * Labels GitHub/GitLab inferidos a partir de caminhos tocados (heurística simples).
 */
export function inferLabelsFromPaths(
  paths: readonly string[],
): readonly string[] {
  const set = new Set<string>();
  for (const raw of paths) {
    const p = raw.replace(/\\/gu, '/').toLowerCase();
    if (p.includes('/docs/') || p.endsWith('.md')) {
      set.add('docs');
    }
    if (
      p.includes('/apps/') ||
      p.includes('/packages/app') ||
      p.includes('next.config') ||
      p.includes('/src/app/')
    ) {
      set.add('frontend');
    }
    if (
      p.includes('/api/') ||
      p.includes('packages/backend') ||
      p.includes('/server/') ||
      p.includes('/lambda/')
    ) {
      set.add('backend');
    }
    if (p.includes('/packages/cli') || p.includes('/cmd/')) {
      set.add('cli');
    }
    if (p.includes('docker') || p.includes('.yml') || p.includes('.yaml')) {
      set.add('infra');
    }
  }
  return [...set].sort();
}
