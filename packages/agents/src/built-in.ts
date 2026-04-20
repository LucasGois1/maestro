import { z } from 'zod';

import type { AgentDefinition } from './definition.js';

const textInputSchema = z.object({ prompt: z.string().min(1) });

const plannerOutputSchema = z.object({
  summary: z.string(),
  sprints: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      acceptance: z.array(z.string()).default([]),
    }),
  ),
});

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

export const plannerAgent: AgentDefinition<
  z.infer<typeof textInputSchema>,
  z.infer<typeof plannerOutputSchema>
> = {
  id: 'planner',
  role: 'pipeline',
  stage: 1,
  systemPrompt:
    'You are the Maestro Planner. Expand the user prompt into a JSON spec with a short summary and a list of sprints, each with id, description, and acceptance criteria. Reply with only the JSON object (no prose).',
  inputSchema: textInputSchema,
  outputSchema: plannerOutputSchema,
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

export const BUILT_IN_AGENTS = [
  plannerAgent,
  architectAgent,
  generatorAgent,
  evaluatorAgent,
  mergerAgent,
  codeReviewerAgent,
  docGardenerAgent,
] as const;
