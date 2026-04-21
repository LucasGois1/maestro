# Agente Architect (DSFT-91)

O **Architect** valida, por sprint, o plano do Planner contra `ARCHITECTURE.md` e restrições técnicas do repositório. Produz JSON validado por `architectModelOutputSchema` em `@maestro/agents`, com escopo técnico, padrões, bibliotecas e um *boundary check*. O pipeline grava as notas em `.maestro/runs/<runId>/design-notes/design-notes-sprint-<n>.md` e insere um bloco `### Architect notes` na secção correspondente de `plan.md`.

## Entrada

Corpo validado por `architectAgent.inputSchema`:

- `plan` — plano normalizado (`PlannerOutput` / objeto com sprints).
- `architecture` — texto completo de `ARCHITECTURE.md` (ou override); o motor pré-carrega `.maestro/ARCHITECTURE.md` se a opção do pipeline estiver vazia.
- `sprint` — sprint corrente (forma do pipeline).
- `sprintIdx` — índice 0-based do sprint no array (para contexto no runner).

## Saída

Objeto JSON único (sem fences) com:

- `sprintIdx` (1-based, alinhado a `### Sprint N` e aos ficheiros de design notes).
- `scopeTecnico`: `newFiles[]` (`path`, `layer`), `filesToTouch[]`, `testFiles[]`.
- `patternsToFollow[]`, `libraries[]` (`name`, `reason`).
- `boundaryCheck`: `ok` | `refactor_needed` | `violation`.
- `boundaryNotes?`, `escalation?` (`reason`).

Após o parse, `finalizeArchitectOutput` define **`approved`** como `boundaryCheck === 'ok'` e ausência de `escalation`. Qualquer outro caso bloqueia o sprint no pipeline (escalação com `PipelineEscalationError`).

## Ferramentas (AI SDK)

O runner usa `generateText` com limite de passos (tool loop), no mesmo padrão do Planner, com o conjunto do Architect:

| Ferramenta       | Função |
|------------------|--------|
| `readKB`         | KB Maestro e `docs/` na raiz (como no Planner). |
| `listDirectory`  | Listagem segura sob a raiz do repo. |
| `searchCode`     | Pesquisa literal com ripgrep. |
| `readFile`       | Leitura de ficheiros relativos à raiz do repositório (validação de caminho partilhada com o Planner). |
| `getDependencies`| Resumo de manifestos (`package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, etc.). |

Eventos `agent.tool_call` / `agent.tool_result` são emitidos no bus.

## Calibração

`architectAgent` inclui `calibration.fewShotExamples` (quatro cenários em `packages/agents/src/architect/fixtures-data.ts`). O prompt de sistema resolvido está coberto por snapshot em `packages/agents/src/architect/system-prompt.snapshot.test.ts`.

## Artefactos e pipeline

- **Documento de arquitetura:** `loadArchitectureDocument` lê `.maestro/ARCHITECTURE.md` ou usa o texto passado em `PipelineRunOptions.architecture`.
- **Ficheiros:** `renderArchitectNotesMarkdown` gera o markdown por sprint; `architectNotesForPlanEmbed` produz o bloco embutido em `plan.md`.
- **Política:** se `!approved`, o pipeline emite `pipeline.sprint_escalated`, atualiza o estado para pausado/escalado e interrompe a execução antes do generator.

## Limitações

- Leituras e ferramentas respeitam a raiz do repositório (sem `..`).
- O modelo deve responder com um único objeto JSON; reparação de JSON quase válido segue a mesma lógica do runner que os outros agentes estruturados.

## Relação com o Planner e o Generator

O Planner define **o quê**; o Architect confirma **como** e **onde** no código, em linha com a arquitetura documentada. O generator recebe o sprint já depois do gate do Architect nesta versão; enriquecer o contrato com as notas de design fica como evolução opcional.
