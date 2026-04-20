export const KB_PACKAGE_NAME = '@maestro/kb';

export {
  createKBManager,
  type AgentKBContext,
  type CreateKBManagerOptions,
  type KBManager,
} from './manager.js';

export {
  lintKnowledgeBase,
  type KBLintIssue,
  type KBLintReport,
  type LintKnowledgeBaseOptions,
} from './lint.js';
