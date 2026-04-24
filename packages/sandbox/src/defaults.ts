/**
 * Comandos permitidos sem prompt em qualquer `permissions.mode` (após o denylist).
 * Usado para automação do Merger/Doc Gardener (PR/MR) sem `approver` interativo —
 * os toolsets ainda passam `denyAllPrompter`, que nega qualquer `kind: 'ask'`.
 */
export const TRUSTED_AUTOMATION_PATTERNS: readonly string[] = [
  'gh pr create*',
  'glab mr create*',
] as const;

export const DEFAULT_DENYLIST: readonly string[] = [
  'rm -rf /',
  'rm -rf /*',
  'rm -rf ~',
  'rm -rf ~/*',
  'rm -rf $HOME',
  'rm -rf $HOME/*',
  'sudo *',
  'doas *',
  '*curl*|*sh*',
  '*curl*|*bash*',
  '*wget*|*sh*',
  '*wget*|*bash*',
  'chmod 777 *',
  'chmod -R 777 *',
  ':(){:|:&};:',
  '> /dev/sda*',
  'dd if=*',
  'git push --force*',
  'git push -f *',
  'git push --force-with-lease*',
] as const;

export const DEFAULT_ALLOWLIST: readonly string[] = [
  'pytest*',
  'npm test*',
  'npm run test*',
  'pnpm test*',
  'pnpm -r *',
  'yarn test*',
  'cargo build*',
  'cargo test*',
  'go test*',
  'go build*',
  'ruff*',
  'mypy*',
  'eslint*',
  'tsc*',
  'prettier*',
  'git status',
  'git diff*',
  'git log*',
  'git show*',
  'git branch*',
  'git rev-parse*',
  'ls*',
  'cat*',
  'head*',
  'tail*',
] as const;
