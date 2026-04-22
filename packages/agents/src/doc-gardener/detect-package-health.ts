import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type PackageHealthKind =
  | 'outdated_dep'
  | 'knip_issue';

export type PackageHealthFinding = {
  readonly path: string;
  readonly message: string;
  readonly kind: PackageHealthKind;
};

type RunCmdOptions = {
  readonly cwd: string;
  readonly timeoutMs: number;
};

/** `pnpm` / Knip podem sair com código ≠ 0 mas ainda enviar stdout útil. */
async function runCmd(
  program: string,
  args: readonly string[],
  opts: RunCmdOptions,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(program, [...args], {
      cwd: opts.cwd,
      timeout: opts.timeoutMs,
      maxBuffer: 10_000_000,
    });
    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    };
  } catch (e) {
    const err = e as NodeJS.ErrnoException & {
      stdout?: Buffer;
      stderr?: Buffer;
    };
    const stdout = err.stdout?.toString() ?? '';
    const stderr = err.stderr?.toString() ?? '';
    if (err.code === 'ENOENT') {
      return { stdout: '', stderr: `command not found: ${program}` };
    }
    return { stdout, stderr };
  }
}

/**
 * Formato condensado típico do `pnpm outdated`: `pkg: current → latest`.
 */
export function parsePnpmOutdatedText(
  stdout: string,
  maxFindings: number,
): readonly PackageHealthFinding[] {
  const out: PackageHealthFinding[] = [];
  for (const line of stdout.split('\n')) {
    const t = line.trim();
    const m = /^([^:]+):\s*(\S+)\s*→\s*(\S+)/u.exec(t);
    if (m?.[1] === undefined || m[2] === undefined || m[3] === undefined) {
      continue;
    }
    const name = m[1].trim();
    out.push({
      path: name,
      message: `Outdated dependency ${name}: ${m[2]} → ${m[3]}`,
      kind: 'outdated_dep',
    });
    if (out.length >= maxFindings) break;
  }
  return out;
}

function summarizeKnipIssue(issue: Record<string, unknown>): string {
  const bits: string[] = [];
  for (const key of [
    'dependencies',
    'devDependencies',
    'optionalPeerDependencies',
    'unlisted',
    'exports',
    'types',
    'duplicates',
    'binaries',
    'unresolved',
  ] as const) {
    const v = issue[key];
    if (Array.isArray(v) && v.length > 0) {
      bits.push(`${key}: ${v.length.toString()}`);
    }
  }
  return bits.length > 0 ? bits.join(', ') : 'Knip reported issue';
}

/**
 * Parse do JSON do Knip (`--reporter json`).
 */
export function parseKnipReporterJson(
  stdout: string,
  maxFindings: number,
): readonly PackageHealthFinding[] {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (typeof data !== 'object' || data === null) return [];
  const d = data as { issues?: unknown };
  if (!Array.isArray(d.issues)) return [];
  const out: PackageHealthFinding[] = [];
  for (const raw of d.issues) {
    if (typeof raw !== 'object' || raw === null) continue;
    const issue = raw as Record<string, unknown>;
    const file = String(issue.file ?? 'unknown');
    out.push({
      path: file,
      message: summarizeKnipIssue(issue),
      kind: 'knip_issue',
    });
    if (out.length >= maxFindings) break;
  }
  return out;
}

export type RunPackageHealthOptions = {
  readonly timeoutMs: number;
  readonly maxFindings: number;
};

/** `pnpm outdated` (texto condensado) — não requer JSON; funciona com pnpm 9+. */
export async function detectPnpmOutdated(
  repoRoot: string,
  opts: RunPackageHealthOptions,
): Promise<readonly PackageHealthFinding[]> {
  const r = await runCmd(
    'pnpm',
    ['outdated'],
    { cwd: repoRoot, timeoutMs: opts.timeoutMs },
  );
  const text = `${r.stdout}\n${r.stderr}`;
  return parsePnpmOutdatedText(text, opts.maxFindings);
}

/** `pnpm exec knip --reporter json` (requer Knip no workspace). */
export async function detectKnipIssues(
  repoRoot: string,
  opts: RunPackageHealthOptions,
): Promise<readonly PackageHealthFinding[]> {
  const r = await runCmd(
    'pnpm',
    ['exec', 'knip', '--reporter', 'json', '--no-progress'],
    { cwd: repoRoot, timeoutMs: opts.timeoutMs },
  );
  const text = r.stdout.trim().length > 0 ? r.stdout : r.stderr;
  const parsed = parseKnipReporterJson(text, opts.maxFindings);
  if (parsed.length > 0) return parsed;
  return [];
}
