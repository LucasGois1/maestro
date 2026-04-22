/** Max length for the argument hint after the em dash (panel also truncates total line). */
const MAX_HINT = 72;

function collapseWs(s: string): string {
  return s.replace(/\s+/gu, ' ').trim();
}

export function ellipsis(s: string, max: number): string {
  const t = collapseWs(s);
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stringField(
  o: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = o[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function compactFallbackSummary(o: Record<string, unknown>): string {
  const skip = new Set([
    'content',
    'oldStr',
    'newStr',
    'body',
    'diff',
    'structuredFeedback',
  ]);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (skip.has(k)) {
      continue;
    }
    if (v === undefined || v === null) {
      continue;
    }
    if (typeof v === 'string') {
      const t = collapseWs(v);
      if (t.length > 0) {
        parts.push(`${k}: ${ellipsis(t, 48)}`);
      }
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      parts.push(`${k}: ${String(v)}`);
    } else if (Array.isArray(v) && v.every((x) => typeof x === 'string')) {
      parts.push(`${k}: ${ellipsis(v.join(' '), 40)}`);
    }
    if (parts.length >= 4) {
      break;
    }
  }
  return parts.length > 0 ? parts.join(' · ') : '';
}

/**
 * One-line summary for the Active Agent panel: tool name plus a short hint from args.
 */
export function formatToolCallSummary(tool: string, args: unknown): string {
  if (args === null || args === undefined) {
    return tool;
  }

  if (!isPlainObject(args)) {
    return `${tool} — ${ellipsis(JSON.stringify(args), MAX_HINT)}`;
  }

  const o = args;
  const keys = Object.keys(o);
  if (keys.length === 0) {
    return tool;
  }

  const path =
    stringField(o, 'path') ??
    stringField(o, 'relativePath') ??
    stringField(o, 'file');

  switch (tool) {
    case 'readFile':
    case 'writeFile':
    case 'read_file':
    case 'write_file':
      return path !== undefined
        ? `${tool} — ${ellipsis(path, MAX_HINT)}`
        : `${tool} — ${ellipsis(compactFallbackSummary(o) || JSON.stringify(o), MAX_HINT)}`;

    case 'editFile':
    case 'edit_file': {
      const base =
        path !== undefined ? path : compactFallbackSummary(o) || '(file?)';
      const oldPeek = stringField(o, 'oldStr');
      const hint =
        oldPeek !== undefined
          ? `${ellipsis(base, 44)} · ${ellipsis(oldPeek, 40)}`
          : ellipsis(base, MAX_HINT);
      return `${tool} — ${hint}`;
    }

    case 'appendFile':
      return path !== undefined
        ? `${tool} — ${ellipsis(path, MAX_HINT)}`
        : `${tool} — ${ellipsis(compactFallbackSummary(o), MAX_HINT)}`;

    case 'listDirectory':
    case 'list_directory': {
      const rp = stringField(o, 'relativePath');
      const depth = o.maxDepth;
      const depthBit =
        typeof depth === 'number' ? ` · depth ${depth.toString()}` : '';
      return `${tool} — ${ellipsis(rp ?? '.', MAX_HINT - depthBit.length)}${depthBit}`;
    }

    case 'searchCode':
    case 'search_code': {
      const q = stringField(o, 'query');
      return q !== undefined
        ? `${tool} — ${ellipsis(q, MAX_HINT)}`
        : `${tool} — ${ellipsis(compactFallbackSummary(o), MAX_HINT)}`;
    }

    case 'readKB':
    case 'read_kb':
      return path !== undefined
        ? `${tool} — ${ellipsis(path, MAX_HINT)}`
        : `${tool}`;

    case 'runShell':
    case 'run_shell': {
      const cmd = stringField(o, 'cmd') ?? '';
      const shellArgs = Array.isArray(o.args)
        ? o.args.filter((x): x is string => typeof x === 'string').join(' ')
        : '';
      const line = [cmd, shellArgs].filter((s) => s.length > 0).join(' ');
      return line.length > 0
        ? `${tool} — ${ellipsis(line, MAX_HINT)}`
        : tool;
    }

    case 'runSensor':
    case 'run_sensor': {
      const id = stringField(o, 'id');
      return id !== undefined ? `${tool} — ${ellipsis(id, MAX_HINT)}` : tool;
    }

    case 'gitCommit':
    case 'git_commit': {
      const type = stringField(o, 'type');
      const scope = stringField(o, 'scope');
      const subject = stringField(o, 'subject');
      let msg = '';
      if (type !== undefined && scope !== undefined && subject !== undefined) {
        msg = `${type}(${scope}): ${subject}`;
      } else if (type !== undefined && subject !== undefined) {
        msg = `${type}: ${subject}`;
      } else if (subject !== undefined) {
        msg = subject;
      } else {
        msg = compactFallbackSummary(o);
      }
      return msg.length > 0
        ? `${tool} — ${ellipsis(msg, MAX_HINT)}`
        : tool;
    }

    case 'getDependencies':
      return `${tool} — scan package manifests`;

    case 'gitLog':
    case 'git_log': {
      const range = stringField(o, 'revisionRange');
      const max = o.maxCount;
      const bits = [
        range !== undefined ? `range ${ellipsis(range, 36)}` : '',
        typeof max === 'number' ? `n=${max.toString()}` : '',
      ].filter((s) => s.length > 0);
      return bits.length > 0
        ? `${tool} — ${bits.join(' · ')}`
        : `${tool} — recent commits`;
    }

    default: {
      const fb = compactFallbackSummary(o);
      if (fb.length > 0) {
        return `${tool} — ${ellipsis(fb, MAX_HINT)}`;
      }
      try {
        const json = JSON.stringify(o);
        return json.length > 2
          ? `${tool} — ${ellipsis(json, MAX_HINT)}`
          : tool;
      } catch {
        return tool;
      }
    }
  }
}
