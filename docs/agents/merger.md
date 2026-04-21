# Agente Merger (DSFT-94)

O **Merger** fecha o pipeline após todos os sprints terem passado no Evaluator: recebe o plano completo, um resumo por sprint e metadados do remote Git; usa ferramentas (`readFile`, `writeFile`, `appendFile` sob `.maestro/`, `runShell` com allowlist `git`/`gh`/`glab`, `gitLog`) para preparar PR/MR e devolve JSON validado por `mergerModelOutputSchema`.

O **motor do pipeline** (`runPipeline`) monta `mergerInputSchema`, chama `detectRemote` na worktree, grava sempre um exec-plan em `.maestro/docs/exec-plans/completed/<slug>.md`, faz `appendProjectLog` em `.maestro/log.md` e opcionalmente remove a worktree.

## Entrada (`mergerInputSchema`)

- `runId`, `repoRoot`, `worktreeRoot`, `branch`, `baseBranch?`
- `planMarkdown` — conteúdo de `.maestro/runs/<runId>/plan.md`
- `planSummary`, `featureName`
- `sprintOutcomes[]` — índice do sprint, nome, ficheiros tocados, decisão do evaluator, tentativas
- `aggregatedAcceptance[]` — critérios agregados
- `remote` — `{ platform, url, name? }` ou `null` se não houver `origin`
- `requireDraftPr?` — também configurável em `config.merger.requireDraftPr` ou `PipelineRunOptions.requireDraftPr`
- `pipelineStartedAt?`, `durationMs?`
- `suggestedLabels` — inclui heurística `inferLabelsFromPaths` + `maestro` e `ai-generated`
- `execPlanRelativePath` — caminho relativo onde o pipeline irá gravar o exec-plan (o modelo deve ecoar no output)
- `coAuthoredByLine?` — `config.merger.coAuthoredByLine` para footer de PR

## Saída (`mergerModelOutputSchema`)

- `runStatus`: `completed` | `partial` | `failed`
- `branch`, `commitCount`, `execPlanPath`, `cleanupDone`
- `prUrl?`, `prNumber?`, `summary?`, `prTitle?`

O campo `execPlanPath` no resultado final é **alinhado pelo pipeline** ao ficheiro realmente escrito após o parse do modelo.

## gh vs glab

`detectRemote` infere `github` / `gitlab` / `unknown` a partir do URL. `buildPrCommand` em `@maestro/git` gera `gh pr create` ou `glab mr create`; suporta `draft: true` (`--draft` em ambos).

## Sem remote

Com `remote: null`, o modelo não deve assumir PR; o pipeline regista o facto no `log.md` e o merger pode devolver `runStatus: completed` sem `prUrl`.

## Draft PR

`requireDraftPr` força rascunho quando crias PR via CLI. Com o motor actual, **escaladas de sprint não chegam ao Merger**; `partial`/`draft` ligam-se a este sinal ou a evoluções futuras do pipeline.

## Limpeza de worktree

`config.merger.removeWorktreeOnSuccess` ou `PipelineRunOptions.removeWorktreeOnSuccess`: após sucesso (`runStatus === 'completed'`), se `worktreePath !== repoRoot`, o engine chama `removeWorktree` e define `cleanupDone` a `true`.

## Testes

Fixtures em `packages/agents/src/merger/fixtures-data.ts`; snapshot do prompt em `packages/agents/src/merger/system-prompt.snapshot.test.ts`; integração do pipeline em `packages/pipeline/src/engine.test.ts`.
