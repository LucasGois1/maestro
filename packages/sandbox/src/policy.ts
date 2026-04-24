import type { PermissionMode } from '@maestro/config';

import {
  DEFAULT_ALLOWLIST,
  DEFAULT_DENYLIST,
  TRUSTED_AUTOMATION_PATTERNS,
} from './defaults.js';
import { matchAny, renderCommandLine } from './patterns.js';

export type PolicyDecision =
  | { readonly kind: 'allow'; readonly reason: 'allowlist' | 'yolo' }
  | {
      readonly kind: 'ask';
      readonly reason: 'strict' | 'unmatched';
      readonly commandLine: string;
    }
  | {
      readonly kind: 'deny';
      readonly reason: 'denylist';
      readonly pattern: string;
      readonly commandLine: string;
    };

export type Policy = {
  readonly mode: PermissionMode;
  readonly allowlist: readonly string[];
  readonly denylist: readonly string[];
};

export type ComposePolicyOptions = {
  readonly mode: PermissionMode;
  readonly allowlist?: readonly string[];
  readonly denylist?: readonly string[];
  readonly includeDefaults?: boolean;
};

export function composePolicy(options: ComposePolicyOptions): Policy {
  const includeDefaults = options.includeDefaults ?? true;
  const allowlist = includeDefaults
    ? [...DEFAULT_ALLOWLIST, ...(options.allowlist ?? [])]
    : [...(options.allowlist ?? [])];
  const denylist = includeDefaults
    ? [...DEFAULT_DENYLIST, ...(options.denylist ?? [])]
    : [...(options.denylist ?? [])];
  return { mode: options.mode, allowlist, denylist };
}

export type CheckCommandOptions = {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly policy: Policy;
};

export function checkCommand(options: CheckCommandOptions): PolicyDecision {
  const commandLine = renderCommandLine(options.cmd, options.args);

  const denyPattern = matchAny(options.policy.denylist, commandLine);
  if (denyPattern) {
    return {
      kind: 'deny',
      reason: 'denylist',
      pattern: denyPattern,
      commandLine,
    };
  }

  if (matchAny(TRUSTED_AUTOMATION_PATTERNS, commandLine)) {
    return { kind: 'allow', reason: 'allowlist' };
  }

  if (options.policy.mode === 'yolo') {
    return { kind: 'allow', reason: 'yolo' };
  }

  if (options.policy.mode === 'strict') {
    return { kind: 'ask', reason: 'strict', commandLine };
  }

  // allowlist mode
  const allowPattern = matchAny(options.policy.allowlist, commandLine);
  if (allowPattern) {
    return { kind: 'allow', reason: 'allowlist' };
  }
  return { kind: 'ask', reason: 'unmatched', commandLine };
}
