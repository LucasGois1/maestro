import type { ArchitectModelOutput } from './architect-output.schema.js';

/** Markdown para `design-notes-sprint-<n>.md` e bloco em plan.md. */
export function renderArchitectNotesMarkdown(
  output: ArchitectModelOutput,
  sprintTitle: string,
): string {
  const lines: string[] = [
    `# Design notes — Sprint ${output.sprintIdx.toString()} — ${sprintTitle}`,
    '',
    '## Scope técnico',
    '',
    '### Novos ficheiros',
  ];

  if (output.scopeTecnico.newFiles.length === 0) {
    lines.push('- _(nenhum)_');
  } else {
    for (const f of output.scopeTecnico.newFiles) {
      lines.push(`- \`${f.path}\` (${f.layer})`);
    }
  }

  lines.push('', '### Ficheiros a alterar');
  if (output.scopeTecnico.filesToTouch.length === 0) {
    lines.push('- _(nenhum)_');
  } else {
    for (const p of output.scopeTecnico.filesToTouch) {
      lines.push(`- \`${p}\``);
    }
  }

  lines.push('', '### Testes');
  if (output.scopeTecnico.testFiles.length === 0) {
    lines.push('- _(nenhum)_');
  } else {
    for (const p of output.scopeTecnico.testFiles) {
      lines.push(`- \`${p}\``);
    }
  }

  lines.push('', '## Padrões a seguir');
  if (output.patternsToFollow.length === 0) {
    lines.push('- —');
  } else {
    for (const p of output.patternsToFollow) {
      lines.push(`- ${p}`);
    }
  }

  lines.push('', '## Bibliotecas');
  if (output.libraries.length === 0) {
    lines.push('- —');
  } else {
    for (const lib of output.libraries) {
      lines.push(`- **${lib.name}** — ${lib.reason}`);
    }
  }

  lines.push(
    '',
    '## Boundary check',
    '',
    `**Estado:** \`${output.boundaryCheck}\``,
  );
  if (output.boundaryNotes?.trim()) {
    lines.push('', output.boundaryNotes.trim());
  }
  if (output.escalation) {
    lines.push('', `**Escalação:** ${output.escalation.reason}`);
  }

  lines.push('');
  return lines.join('\n');
}

/** Bloco `### Architect notes` para inserir em `plan.md` (sem H1 duplicado). */
export function architectNotesForPlanEmbed(
  output: ArchitectModelOutput,
  sprintTitle: string,
): string {
  const full = renderArchitectNotesMarkdown(output, sprintTitle);
  const withoutH1 = full.replace(/^#[^\n]+\n+/u, '').trim();
  return `### Architect notes\n\n${withoutH1}\n`;
}
