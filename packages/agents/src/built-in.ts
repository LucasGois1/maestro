import { z } from 'zod';

import type { AgentDefinition } from './definition.js';
import { architectModelOutputSchema } from './architect/architect-output.schema.js';
import { ARCHITECT_FEW_SHOT_EXAMPLES as ARCHITECT_CALIBRATION } from './architect/calibration.js';
import { ARCHITECT_SYSTEM_PROMPT } from './architect/system-prompt.js';
import { GENERATOR_FEW_SHOT_EXAMPLES as GENERATOR_CALIBRATION } from './generator/calibration.js';
import { generatorInputSchema } from './generator/generator-input.schema.js';
import { generatorModelOutputSchema } from './generator/generator-output.schema.js';
import { GENERATOR_SYSTEM_PROMPT } from './generator/system-prompt.js';
import { EVALUATOR_FEW_SHOT_EXAMPLES as EVALUATOR_CALIBRATION } from './evaluator/calibration.js';
import { evaluatorInputSchema } from './evaluator/evaluator-input.schema.js';
import { evaluatorModelOutputSchema } from './evaluator/evaluator-output.schema.js';
import { EVALUATOR_SYSTEM_PROMPT } from './evaluator/system-prompt.js';
import { MERGER_FEW_SHOT_EXAMPLES as MERGER_CALIBRATION } from './merger/calibration.js';
import { mergerInputSchema } from './merger/merger-input.schema.js';
import { mergerModelOutputSchema } from './merger/merger-output.schema.js';
import { MERGER_SYSTEM_PROMPT } from './merger/system-prompt.js';
import { PLANNER_FEW_SHOT_EXAMPLES } from './planner/calibration.js';
import { plannerModelOutputSchema } from './planner/plan-output.schema.js';
import { PLANNER_SYSTEM_PROMPT } from './planner/system-prompt.js';
import { CODE_REVIEWER_FEW_SHOT_EXAMPLES as CODE_REVIEWER_CALIBRATION } from './code-reviewer/calibration.js';
import { codeReviewInputSchema } from './code-reviewer/code-review-input.schema.js';
import { codeReviewOutputSchema } from '@maestro/sensors';
import { CODE_REVIEWER_SYSTEM_PROMPT } from './code-reviewer/system-prompt.js';
import { DOC_GARDENER_FEW_SHOT_EXAMPLES } from './doc-gardener/calibration.js';
import { gardenerInputSchema } from './doc-gardener/gardener-input.schema.js';
import { gardenerOutputSchema } from './doc-gardener/gardener-output.schema.js';
import { DOC_GARDENER_SYSTEM_PROMPT } from './doc-gardener/system-prompt.js';

const textInputSchema = z.object({ prompt: z.string().min(1) });

const architectInputSchema = z.object({
  plan: z.unknown(),
  architecture: z.string().min(1),
  sprint: z.unknown(),
  sprintIdx: z.number().int().nonnegative(),
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
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
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
  z.infer<typeof architectInputSchema>,
  z.infer<typeof architectModelOutputSchema>
> = {
  id: 'architect',
  role: 'pipeline',
  stage: 2,
  systemPrompt: ARCHITECT_SYSTEM_PROMPT,
  inputSchema: architectInputSchema,
  outputSchema: architectModelOutputSchema,
  tools: [
    'readKB',
    'listDirectory',
    'searchCode',
    'readFile',
    'getDependencies',
  ],
  calibration: {
    fewShotExamples: ARCHITECT_CALIBRATION,
  },
};

export const generatorAgent: AgentDefinition<
  z.infer<typeof generatorInputSchema>,
  z.infer<typeof generatorModelOutputSchema>
> = {
  id: 'generator',
  role: 'pipeline',
  stage: 3,
  systemPrompt: GENERATOR_SYSTEM_PROMPT,
  inputSchema: generatorInputSchema,
  outputSchema: generatorModelOutputSchema,
  tools: [
    'readFile',
    'writeFile',
    'editFile',
    'runShell',
    'runSensor',
    'gitCommit',
    'listDirectory',
    'searchCode',
  ],
  calibration: {
    fewShotExamples: GENERATOR_CALIBRATION,
  },
};

export const evaluatorAgent: AgentDefinition<
  z.infer<typeof evaluatorInputSchema>,
  z.infer<typeof evaluatorModelOutputSchema>
> = {
  id: 'evaluator',
  role: 'pipeline',
  stage: 4,
  systemPrompt: EVALUATOR_SYSTEM_PROMPT,
  inputSchema: evaluatorInputSchema,
  outputSchema: evaluatorModelOutputSchema,
  tools: [
    'readFile',
    'runShell',
    'runSensor',
    'navigateBrowser',
    'querySqlite',
    'callApi',
  ],
  calibration: {
    fewShotExamples: EVALUATOR_CALIBRATION,
  },
};

export const mergerAgent: AgentDefinition<
  z.infer<typeof mergerInputSchema>,
  z.infer<typeof mergerModelOutputSchema>
> = {
  id: 'merger',
  role: 'pipeline',
  stage: 5,
  systemPrompt: MERGER_SYSTEM_PROMPT,
  inputSchema: mergerInputSchema,
  outputSchema: mergerModelOutputSchema,
  tools: ['readFile', 'writeFile', 'appendFile', 'runShell', 'gitLog'],
  calibration: {
    fewShotExamples: MERGER_CALIBRATION,
  },
};

export const codeReviewerAgent: AgentDefinition<
  z.infer<typeof codeReviewInputSchema>,
  z.infer<typeof codeReviewOutputSchema>
> = {
  id: 'code-reviewer',
  role: 'sensor',
  systemPrompt: CODE_REVIEWER_SYSTEM_PROMPT,
  inputSchema: codeReviewInputSchema,
  outputSchema: codeReviewOutputSchema,
  calibration: {
    fewShotExamples: CODE_REVIEWER_CALIBRATION,
  },
};

export const docGardenerAgent: AgentDefinition<
  z.infer<typeof gardenerInputSchema>,
  z.infer<typeof gardenerOutputSchema>
> = {
  id: 'doc-gardener',
  role: 'background',
  systemPrompt: DOC_GARDENER_SYSTEM_PROMPT,
  inputSchema: gardenerInputSchema,
  outputSchema: gardenerOutputSchema,
  calibration: {
    fewShotExamples: DOC_GARDENER_FEW_SHOT_EXAMPLES,
  },
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
