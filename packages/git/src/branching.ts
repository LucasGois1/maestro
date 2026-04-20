import type { BranchingStrategy } from '@maestro/config';

export const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'chore',
  'refactor',
  'docs',
  'test',
  'perf',
  'style',
  'build',
  'ci',
] as const;

export type ConventionalType = (typeof CONVENTIONAL_TYPES)[number];

export class BranchNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BranchNameError';
  }
}

export type BranchContext = {
  readonly runId: string;
  readonly prompt: string;
  readonly user?: string;
  readonly now?: Date;
  readonly type?: ConventionalType;
  readonly askedName?: string;
};

export type ComputeBranchOptions = {
  readonly strategy: BranchingStrategy;
  readonly prefix: string;
  readonly template?: string;
  readonly context: BranchContext;
};

export function slugify(input: string, maxLength = 40): string {
  const cleaned = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (cleaned.length === 0) return 'run';
  return cleaned.slice(0, maxLength).replace(/-+$/u, '');
}

function detectConventionalType(prompt: string): ConventionalType {
  const lower = prompt.toLowerCase();
  if (/\b(fix|bug|issue|regression)\b/u.test(lower)) return 'fix';
  if (/\b(doc|readme|changelog)\b/u.test(lower)) return 'docs';
  if (/\b(test|coverage)\b/u.test(lower)) return 'test';
  if (/\b(refactor|cleanup)\b/u.test(lower)) return 'refactor';
  if (/\b(chore|bump|upgrade|dependency)\b/u.test(lower)) return 'chore';
  if (/\b(perf|performance|optimi[sz]e)\b/u.test(lower)) return 'perf';
  if (/\b(ci|pipeline|github action)\b/u.test(lower)) return 'ci';
  return 'feat';
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(run_id|slug|user|date|type)\}/gu, (_, key) => {
    const value = vars[key as keyof typeof vars];
    if (value === undefined) {
      throw new BranchNameError(`Template variable {${key}} has no value.`);
    }
    return value;
  });
}

function sanitizeBranchName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new BranchNameError('Branch name cannot be empty.');
  }
  // eslint-disable-next-line no-control-regex -- git refname rules forbid control chars
  if (/[\x00-\x1f\x7f ~^:?*[\\]/u.test(trimmed)) {
    throw new BranchNameError(
      `Branch name "${trimmed}" contains forbidden characters.`,
    );
  }
  if (trimmed.endsWith('.') || trimmed.startsWith('.')) {
    throw new BranchNameError(
      `Branch name "${trimmed}" cannot begin or end with a dot.`,
    );
  }
  return trimmed;
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function computeBranchName(options: ComputeBranchOptions): string {
  const { strategy, prefix, context } = options;
  const slug = slugify(context.prompt);
  const type = context.type ?? detectConventionalType(context.prompt);
  const date = formatDate(context.now ?? new Date());
  const user = context.user ?? 'maestro';

  if (strategy === 'conventional') {
    return sanitizeBranchName(`${prefix}${type}-${slug}`);
  }

  if (strategy === 'custom') {
    if (!options.template || options.template.trim().length === 0) {
      throw new BranchNameError(
        'Custom branching strategy requires a non-empty template.',
      );
    }
    const resolved = applyTemplate(options.template, {
      run_id: context.runId,
      slug,
      user,
      date,
      type,
    });
    return sanitizeBranchName(resolved);
  }

  if (strategy === 'ask') {
    if (!context.askedName || context.askedName.trim().length === 0) {
      throw new BranchNameError(
        'Ask strategy requires context.askedName to be provided by the caller.',
      );
    }
    return sanitizeBranchName(context.askedName);
  }

  throw new BranchNameError(`Unknown branching strategy: ${String(strategy)}`);
}
