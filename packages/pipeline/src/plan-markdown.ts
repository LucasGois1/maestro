import type { PlannerOutput } from '@maestro/agents';
import { stringify as stringifyYaml } from 'yaml';

function complexityLabel(
  c: PlannerOutput['sprints'][number]['complexity'],
): string {
  if (c === 'low') return 'baixa';
  if (c === 'medium') return 'média';
  return 'alta';
}

/**
 * Serializes planner output to `plan.md` (DSFT-90): YAML frontmatter + markdown sections.
 */
export function serializePlanMarkdown(plan: PlannerOutput): string {
  const frontmatter = stringifyYaml({
    run_id: plan.runId,
    prompt: plan.prompt,
    feature: plan.feature,
    sprints_count: plan.sprints.length,
  });

  const userStoriesBlock = plan.userStories
    .map(
      (us) =>
        `- Como **${us.role}**, quero ${us.action} para ${us.value}. _(id ${us.id.toString()})_`,
    )
    .join('\n');

  const aiBlock =
    plan.aiFeatures.length > 0
      ? [
          '## AI features embutidas',
          '',
          ...plan.aiFeatures.map((f) => `- ${f}`),
          '',
        ].join('\n')
      : '';

  const sprintsBlock = plan.sprints
    .map((sp) => {
      const deps =
        sp.dependsOn.length > 0
          ? `[${sp.dependsOn.map((d) => d.toString()).join(', ')}]`
          : '[]';
      const stories = `[${sp.userStoryIds.map((id) => id.toString()).join(', ')}]`;
      const kf = sp.keyFeatures.map((k) => `  - ${k}`).join('\n');
      return [
        `### Sprint ${sp.idx.toString()} — ${sp.name}`,
        '',
        `**Objetivo:** ${sp.objective}`,
        `**User stories:** ${stories}`,
        `**Depends on:** ${deps}`,
        `**Complexidade estimada:** ${complexityLabel(sp.complexity)}`,
        '**Features chave:**',
        kf.length > 0 ? kf : '  - —',
        '',
      ].join('\n');
    })
    .join('\n');

  return [
    '---',
    frontmatter.trimEnd(),
    '---',
    '',
    `# Plan — ${plan.feature}`,
    '',
    '## Overview',
    '',
    plan.overview.trim(),
    '',
    '## User stories principais',
    '',
    userStoriesBlock,
    '',
    aiBlock,
    '## Sprints',
    '',
    sprintsBlock.trimEnd(),
    '',
  ].join('\n');
}
