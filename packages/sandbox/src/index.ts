export const SANDBOX_PACKAGE_NAME = '@maestro/sandbox';

export { DEFAULT_ALLOWLIST, DEFAULT_DENYLIST } from './defaults.js';

export {
  compilePattern,
  matchAny,
  matchCompiled,
  renderCommandLine,
  type PatternSegments,
} from './patterns.js';

export {
  checkCommand,
  composePolicy,
  type CheckCommandOptions,
  type ComposePolicyOptions,
  type Policy,
  type PolicyDecision,
} from './policy.js';

export {
  AUDIT_FILE,
  appendAudit,
  auditFilePath,
  type AppendAuditOptions,
  type AuditApprover,
  type AuditEntry,
} from './audit.js';

export {
  CommandDeniedError,
  CommandRejectedError,
  denyAllPrompter,
  runShellCommand,
  type ApprovalDecision,
  type ApprovalPrompter,
  type ApprovalRequest,
  type RunCommandOptions,
  type RunCommandResult,
} from './runner.js';
