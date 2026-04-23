# Agente Generator (DSFT-92)

O **Generator** implementa **um sprint de cada vez** no repositório de trabalho, usando ferramentas (ficheiros, shell com _permission model_, sensores, git) e devolve JSON validado por `generatorModelOutputSchema` em `@maestro/agents`. O pipeline grava `.maestro/runs/<runId>/checkpoints/sprint-<n>-self-eval.md` e atualiza o handoff com `handoffNotes` e lista de ficheiros alterados.

Em `maestro run` com worktree Git, o **estado da run** (`.maestro/runs`, audit de shell, `sensors.json`) fica no checkout principal (`repoRoot` do processo), enquanto **ficheiros de código** são lidos e alterados no **worktree** (`worktreePath`). O input do generator expõe isso como `implementationRoot` e `stateRepoRoot`; o `AgentContext.workingDir` do runner aponta para o worktree.

## Entrada

Corpo validado por `generatorInputSchema`:

- `runId`, `sprintIdx` (0-based no array do plano).
- `implementationRoot` — raiz onde aplicar alterações de código (worktree ou checkout único).
- `stateRepoRoot` — checkout principal com `.maestro/runs`, `sensors.json` e audit de shell.
- `sprint` — sprint normalizado do pipeline.
- `sprintContract` — texto do ficheiro `contracts/sprint-<n>.md` (contrato com `status: agreed` no MVP atual).
- `planFull` — `PlannerOutput` completo.
- `architectNotes` — conteúdo de `design-notes-sprint-<n>.md` (ou vazio se ainda não existir).
- `previousHandoff?` — texto do `checkpoints/sprint-<n-1>-handoff.md` quando não é o primeiro sprint.
- `evaluatorFeedback?` — `{ failures[] }` na 2ª e seguintes tentativas do mesmo sprint quando o Evaluator reprova (retry do pipeline).

## Saída

Objeto JSON único (sem fences) com:

- `sprintIdx` (1-based, alinhado ao sprint do plano).
- `filesChanged[]`: `path`, `changeType` (`added` | `modified` | `deleted`).
- `commits[]`: `sha`, `message` (mensagens **Conventional Commits** validadas no schema).
- `selfEval`: `coversAllCriteria`, `missingCriteria[]`, `concerns[]`.
- `handoffNotes` — texto livre para o handoff em Markdown.

## Ferramentas (AI SDK)

O runner usa `generateText` com limite de passos (tool loop), com `createGeneratorToolSet`:

| Ferramenta      | Função                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| `readFile`      | Leitura sob a raiz de implementação (`implementationRoot`).              |
| `writeFile`     | Cria/substitui ficheiro (caminho relativo seguro).                       |
| `editFile`      | Substitui uma ocorrência única `oldStr` → `newStr`.                      |
| `runShell`      | `cwd` = implementação; audit em `stateRepoRoot` via `@maestro/sandbox`.  |
| `runSensor`     | Executa sensor por id (`.maestro/sensors.json`).                         |
| `gitCommit`     | `commitSprint` com `type` / `scope?` / `subject` (Conventional Commits). |
| `listDirectory` | Igual ao Planner.                                                        |
| `searchCode`    | Ripgrep, igual ao Planner.                                               |

Chrome DevTools / Playwright avançado ficam fora do MVP deste documento (evolução futura).

## Loops

- **Tight loop (interno):** escrever → `runSensor` / corrigir → repetir; **não** consome o orçamento de retries do Evaluator.
- **Outer loop:** Evaluator reprova → pipeline chama o Generator outra vez com `evaluatorFeedback`.

## Calibração

Cinco cenários em `packages/agents/src/generator/fixtures-data.ts`; prompt resolvido com snapshot em `packages/agents/src/generator/system-prompt.snapshot.test.ts`.

## Relação com Evaluator e Merger

O Evaluator valida critérios de aceitação; o Merger fecha o run após todos os sprints. O Generator não substitui revisão humana nem negociação fina de contrato (épico dedicado).
