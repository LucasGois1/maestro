export const GIT_PACKAGE_NAME = '@maestro/git';

export {
  createGitRunner,
  GitCommandError,
  runGit,
  type GitRunner,
  type GitRunOptions,
  type GitRunResult,
} from './runner.js';

export {
  BranchNameError,
  CONVENTIONAL_TYPES,
  computeBranchName,
  slugify,
  type BranchContext,
  type ComputeBranchOptions,
  type ConventionalType,
} from './branching.js';

export {
  createWorktree,
  defaultWorktreesRoot,
  listWorktrees,
  parseWorktreePorcelain,
  removeWorktree,
  type CreateWorktreeOptions,
  type ListWorktreesOptions,
  type RemoveWorktreeOptions,
  type WorktreeInfo,
} from './worktree.js';

export {
  buildCommitMessage,
  commitSprint,
  type CommitOptions,
} from './commit.js';

export {
  commitMaestroKbInit,
  type CommitMaestroKbInitOptions,
  type CommitMaestroKbInitResult,
} from './maestro-kb-init.js';

export {
  detectDivergence,
  type DetectDivergenceOptions,
  type DivergenceReport,
} from './divergence.js';

export { getWorkingTreeDiff } from './working-tree-diff.js';

export { getGitLogOneline, type GitLogOnelineOptions } from './git-log.js';

export {
  buildPrCommand,
  detectRemote,
  executePrCommand,
  parsePrUrlFromCliOutput,
  renderPrBody,
  UnsupportedPlatformError,
  type BuildPrCommandOptions,
  type DetectRemoteOptions,
  type ExecPrOptions,
  type Platform,
  type PlatformCommand,
  type PrDescriptor,
  type RemoteInfo,
} from './platform.js';
