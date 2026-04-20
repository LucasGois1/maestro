/**
 * Shell-style glob matcher limited to `*` (multi) and `?` (single char).
 *
 * Patterns containing the literal pipe `|` are treated as two segments that
 * both must be present (in order) in the input — this matches denylist entries
 * like `*curl*|*sh*` (curl piped into sh).
 */

const REGEX_META = /[.+^$(){}[\]\\]/gu;

function escape(literal: string): string {
  return literal.replace(REGEX_META, '\\$&');
}

function toSegmentRegex(segment: string): RegExp {
  let out = '';
  for (const ch of segment) {
    if (ch === '*') out += '.*';
    else if (ch === '?') out += '.';
    else out += escape(ch);
  }
  return new RegExp(`^${out}$`, 'u');
}

export type PatternSegments = {
  readonly raw: string;
  readonly segments: readonly RegExp[];
};

export function compilePattern(pattern: string): PatternSegments {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error('Pattern must be non-empty');
  }
  const segments = trimmed.split('|').map((p) => toSegmentRegex(p.trim()));
  return { raw: trimmed, segments };
}

export function matchCompiled(
  compiled: PatternSegments,
  input: string,
): boolean {
  const normalized = input.trim();
  const first = compiled.segments[0];
  if (compiled.segments.length === 1 && first) {
    return first.test(normalized);
  }
  // Multi-segment: each segment must be findable as a substring in order.
  // Strip the anchors from each compiled segment and search non-greedily.
  let cursor = 0;
  for (const rx of compiled.segments) {
    const body = rx.source.slice(1, -1); // strip ^ and $
    // Make `.*` non-greedy so we don't consume the rest of the input.
    const lazy = body.replace(/\.\*/gu, '.*?');
    const unanchored = new RegExp(lazy, 'u');
    const m = unanchored.exec(normalized.slice(cursor));
    if (!m) return false;
    cursor += m.index + m[0].length;
  }
  return true;
}

export function matchAny(
  patterns: readonly string[],
  input: string,
): string | null {
  for (const pattern of patterns) {
    try {
      const compiled = compilePattern(pattern);
      if (matchCompiled(compiled, input)) return pattern;
    } catch {
      continue;
    }
  }
  return null;
}

export function renderCommandLine(
  cmd: string,
  args: readonly string[],
): string {
  if (args.length === 0) return cmd;
  return `${cmd} ${args.join(' ')}`;
}
