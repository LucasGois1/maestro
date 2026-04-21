import { z } from 'zod';

import type { AgentDefinition } from './definition.js';
import { PLANNER_FEW_SHOT_EXAMPLES } from './planner/calibration.js';
import { plannerModelOutputSchema } from './planner/plan-output.schema.js';
import { PLANNER_SYSTEM_PROMPT } from './planner/system-prompt.js';

const textInputSchema = z.object({ prompt: z.string().min(1) });

const architectOutputSchema = z.object({
  approved: z.boolean(),
  violations: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

const generatorOutputSchema = z.object({
  summary: z.string(),
  changedFiles: z.array(z.string()).default([]),
  followUps: z.array(z.string()).default([]),
});

const evaluatorOutputSchema = z.object({
  pass: z.boolean(),
  failures: z.array(z.string()).default([]),
  coverage: z.number().min(0).max(1).optional(),
});

const mergerOutputSchema = z.object({
  branch: z.string(),
  prUrl: z.string().url().optional(),
  summary: z.string(),
});

const codeReviewerOutputSchema = z.object({
  verdict: z.enum(['approve', 'request-changes', 'comment']),
  findings: z.array(
    z.object({
      path: z.string(),
      line: z.number().int().nonnegative().optional(),
      message: z.string(),
      severity: z.enum(['info', 'warn', 'error']),
    }),
  ),
});

const docGardenerOutputSchema = z.object({
  updates: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
    }),
  ),
  deletions: z.array(z.string()).default([]),
});

const discoveryInputSchema = z.object({
  repoRoot: z.string(),
  stack: z.object({
    kind: z.string(),
    markers: z.array(z.string()),
    hints: z.record(z.string(), z.unknown()),
  }),
  structure: z.object({
    topLevelNames: z.array(z.string()),
    extensionCounts: z.record(z.string(), z.number()),
    testDirectoryHints: z.array(z.string()),
    approxFileCount: z.number(),
  }),
  fileSamples: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});

/** Models sometimes emit section-keyed objects instead of one markdown string; merge in prompt order. */
const DISCOVERY_AGENTS_SECTION_ORDER = [
  'Header',
  'Repo Map',
  'Docs',
  'Essential Commands',
  'Critical Conventions',
  'Escalation Path',
] as const;

const DISCOVERY_ARCH_SECTION_ORDER = [
  "Bird's Eye View",
  'Code Map',
  'Cross-Cutting Concerns',
  'Module Boundaries',
  'Data Flow',
] as const;

function mergeSectionedMarkdown(
  raw: Record<string, string>,
  preferredOrder: readonly string[],
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const key of preferredOrder) {
    const v = raw[key];
    if (v !== undefined) {
      const t = v.trim();
      if (t.length > 0) {
        parts.push(t);
        seen.add(key);
      }
    }
  }
  for (const [k, v] of Object.entries(raw)) {
    if (seen.has(k)) {
      continue;
    }
    const t = v.trim();
    if (t.length > 0) {
      parts.push(t);
    }
  }
  return parts.join('\n\n');
}

function sectionedMarkdownField(preferredOrder: readonly string[]) {
  const recordToMd = z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()]),
    )
    .transform((obj) => {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        map[k] = typeof v === 'string' ? v : String(v);
      }
      return mergeSectionedMarkdown(map, preferredOrder);
    })
    .pipe(z.string().min(1));

  return z.union([z.string().min(1), recordToMd]);
}

const discoveryOutputSchema = z.object({
  agentsMd: sectionedMarkdownField(DISCOVERY_AGENTS_SECTION_ORDER),
  architectureMd: sectionedMarkdownField(DISCOVERY_ARCH_SECTION_ORDER),
});

export const plannerAgent: AgentDefinition<
  z.infer<typeof textInputSchema>,
  z.infer<typeof plannerModelOutputSchema>
> = {
  id: 'planner',
  role: 'pipeline',
  stage: 1,
  systemPrompt: PLANNER_SYSTEM_PROMPT,
  inputSchema: textInputSchema,
  outputSchema: plannerModelOutputSchema,
  tools: ['readKB', 'listDirectory', 'searchCode'],
  calibration: {
    fewShotExamples: PLANNER_FEW_SHOT_EXAMPLES,
  },
};

export const architectAgent: AgentDefinition<
  { plan: unknown; architecture: string },
  z.infer<typeof architectOutputSchema>
> = {
  id: 'architect',
  role: 'pipeline',
  stage: 2,
  systemPrompt:
    'You are the Maestro Architect. Validate the provided plan against ARCHITECTURE.md. Respond with a JSON object {approved, violations[], notes?}.',
  inputSchema: z.object({
    plan: z.unknown(),
    architecture: z.string(),
  }),
  outputSchema: architectOutputSchema,
};

export const generatorAgent: AgentDefinition<
  { sprint: unknown; repoRoot: string },
  z.infer<typeof generatorOutputSchema>
> = {
  id: 'generator',
  role: 'pipeline',
  stage: 3,
  systemPrompt:
    'You are the Maestro Generator. Implement the given sprint end-to-end and report back a JSON object {summary, changedFiles[], followUps[]}.',
  inputSchema: z.object({
    sprint: z.unknown(),
    repoRoot: z.string(),
  }),
  outputSchema: generatorOutputSchema,
};

export const evaluatorAgent: AgentDefinition<
  { sprint: unknown; acceptance: string[] },
  z.infer<typeof evaluatorOutputSchema>
> = {
  id: 'evaluator',
  role: 'pipeline',
  stage: 4,
  systemPrompt:
    'You are the Maestro Evaluator. Validate the sprint outcome against its acceptance criteria. Reply with JSON {pass, failures[], coverage?}.',
  inputSchema: z.object({
    sprint: z.unknown(),
    acceptance: z.array(z.string()),
  }),
  outputSchema: evaluatorOutputSchema,
};

export const mergerAgent: AgentDefinition<
  { branch: string; summary: string },
  z.infer<typeof mergerOutputSchema>
> = {
  id: 'merger',
  role: 'pipeline',
  stage: 5,
  systemPrompt:
    'You are the Maestro Merger. Package approved changes into a PR. Reply with JSON {branch, prUrl?, summary}.',
  inputSchema: z.object({
    branch: z.string(),
    summary: z.string(),
  }),
  outputSchema: mergerOutputSchema,
};

export const codeReviewerAgent: AgentDefinition<
  { diff: string },
  z.infer<typeof codeReviewerOutputSchema>
> = {
  id: 'code-reviewer',
  role: 'sensor',
  systemPrompt:
    'You are the Maestro Code Reviewer. Read the diff and produce findings. Reply with JSON {verdict, findings[]}.',
  inputSchema: z.object({ diff: z.string() }),
  outputSchema: codeReviewerOutputSchema,
};

export const docGardenerAgent: AgentDefinition<
  { repoRoot: string },
  z.infer<typeof docGardenerOutputSchema>
> = {
  id: 'doc-gardener',
  role: 'background',
  systemPrompt:
    'You are the Maestro Doc Gardener. Suggest doc updates and stale-doc deletions. Reply with JSON {updates[], deletions[]}.',
  inputSchema: z.object({ repoRoot: z.string() }),
  outputSchema: docGardenerOutputSchema,
};

export const discoveryAgent: AgentDefinition<
  z.infer<typeof discoveryInputSchema>,
  z.infer<typeof discoveryOutputSchema>
> = {
  id: 'discovery',
  role: 'background',
  systemPrompt: `You are the Maestro Discovery agent. Given structured repo metadata and small file samples, produce JSON only (no markdown fences) with keys "agentsMd" and "architectureMd".

Prefer each value as a single markdown STRING (full document body). If you structure by section instead, you may use a JSON object whose keys are section titles and values are markdown strings for that section — both shapes are accepted.

Do not put markdown fenced code blocks (triple backticks) inside JSON string values — they break JSON escaping. Use indented lines or one-line shell examples instead.

Quality rules (follow strictly):
- Ground claims in the provided metadata and file samples. Do not invent version numbers, owners, or features not evidenced.
- Repo Map: list meaningful source and product dirs (e.g. packages/, apps/, src/). Do not list dependency/vendor trees (node_modules, venv), build outputs (dist, build, coverage), or .git. If "topLevelNames" in metadata already omits those, mirror that.
- Docs: link to real paths like [CONTRIBUTING.md](./CONTRIBUTING.md) or absolute URLs. Do not use [Label](#anchor) unless that exact heading exists in the same generated file (prefer full URLs for external docs).
- Essential Commands: when package.json appears in samples, align command names with the "scripts" field (e.g. pnpm test if the repo uses pnpm). Include install, build, test, and lint when those scripts exist; otherwise say "TODO: add scripts" briefly.
- Critical Conventions: cite only what you can infer (e.g. ESLint/Prettier from config files, changesets if mentioned). Otherwise use a short TODO.
- Escalation Path: prefer issue trackers or contacts suggested by README/CONTRIBUTING samples; otherwise neutral "maintainers via GitHub issues".
- ARCHITECTURE — Bird's Eye View: one short paragraph on what the system does. Code Map: name real packages/paths from metadata (e.g. packages/cli). Cross-Cutting Concerns: CI/testing/lint only if .github or configs appear in samples. Module Boundaries & Data Flow: stay concrete; avoid vague marketing language.

AGENTS.md must be a concise index (~under 120 lines) with these exact ## headings in order: Header, Repo Map, Docs, Essential Commands, Critical Conventions, Escalation Path. Use bullet lists where appropriate.

ARCHITECTURE.md must use these exact ## headings in order: Bird's Eye View, Code Map, Cross-Cutting Concerns, Module Boundaries, Data Flow. Keep each section short and factual.

If information is missing, write brief TODO placeholders rather than inventing details.`,
  inputSchema: discoveryInputSchema,
  outputSchema: discoveryOutputSchema,
};

export const BUILT_IN_AGENTS = [
  plannerAgent,
  architectAgent,
  generatorAgent,
  evaluatorAgent,
  mergerAgent,
  codeReviewerAgent,
  docGardenerAgent,
  discoveryAgent,
] as const;

/** Exposed for tests: validates + normalizes discovery agent JSON output. */
export { discoveryOutputSchema };
