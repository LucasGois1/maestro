import {
  isPlannerEscalation,
  type PlannerModelOutput,
  type UserStory,
} from './plan-output.schema.js';

/** One sprint row consumed by the pipeline (contracts, generator, evaluator). */
export type PlannerPipelineSprint = {
  readonly id: string;
  readonly description: string;
  readonly acceptance: readonly string[];
  readonly idx: number;
  readonly name: string;
  readonly objective: string;
  readonly dependsOn: readonly number[];
  readonly complexity: 'low' | 'medium' | 'high';
  readonly keyFeatures: readonly string[];
  readonly userStoryIds: readonly number[];
};

/**
 * Full plan attached to `runPipeline` result and `plan.md`.
 * `summary` mirrors `overview` for callers that expect a short line (e.g. merger).
 */
export type PlannerOutput = {
  readonly runId: string;
  readonly prompt: string;
  readonly feature: string;
  readonly overview: string;
  /** Short summary line (same as overview trimmed to one line when possible). */
  readonly summary: string;
  readonly userStories: readonly UserStory[];
  readonly aiFeatures: readonly string[];
  readonly sprints: readonly PlannerPipelineSprint[];
};

function slugifySprintId(name: string, idx: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  const slug = base.length > 0 ? base : `sprint-${idx.toString()}`;
  return slug;
}

function formatAcceptance(
  userStoryIds: readonly number[],
  storyById: Map<number, UserStory>,
  fallbackObjective: string,
): readonly string[] {
  const lines: string[] = [];
  for (const id of userStoryIds) {
    const st = storyById.get(id);
    if (st) {
      lines.push(
        `Como ${st.role}, quero ${st.action} para ${st.value}.`,
      );
    } else {
      lines.push(`Critério (user story #${id.toString()}).`);
    }
  }
  return lines.length > 0 ? lines : [fallbackObjective];
}

/**
 * Merge host context and map the model JSON into the pipeline `PlannerOutput` shape.
 * @throws Error if `escalationReason` is set (host should stop the run).
 */
export function normalizePlannerModelOutput(
  raw: PlannerModelOutput,
  ctx: { readonly runId: string; readonly prompt: string },
): PlannerOutput {
  if (isPlannerEscalation(raw)) {
    throw new Error(`Planner escalation: ${raw.escalationReason}`);
  }

  const storyById = new Map(
    raw.userStories.map((s) => [s.id, s] as const),
  );

  const sprints: PlannerPipelineSprint[] = raw.sprints.map((sp) => {
    const acceptance = formatAcceptance(
      sp.userStoryIds,
      storyById,
      sp.objective,
    );
    return {
      id: slugifySprintId(sp.name, sp.idx),
      description: sp.objective,
      acceptance,
      idx: sp.idx,
      name: sp.name,
      objective: sp.objective,
      dependsOn: sp.dependsOn,
      complexity: sp.complexity,
      keyFeatures: sp.keyFeatures,
      userStoryIds: sp.userStoryIds,
    };
  });

  const overview = raw.overview.trim();
  const summary =
    overview.split('\n')[0]?.trim() ?? overview.slice(0, 200);

  return {
    runId: ctx.runId,
    prompt: ctx.prompt,
    feature: raw.feature.trim(),
    overview,
    summary,
    userStories: raw.userStories,
    aiFeatures: raw.aiFeatures ?? [],
    sprints,
  };
}
