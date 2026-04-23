# Agente Planner (DSFT-90)

O **Planner** transforma um prompt curto numa especificação de produto com histórias de utilizador, capacidades de IA opcionais e uma sequência de sprints (cada uma com dependências e complexidade). O resultado é JSON validado por `plannerModelOutputSchema` em `@maestro/agents`, normalizado para `PlannerOutput` e gravado em `.maestro/runs/<runId>/plan.md` com frontmatter YAML.

## Entrada

- Corpo: `{ "prompt": "<texto do utilizador>" }` (schema `textInputSchema`).

## Saída

- **Plano completo:** `feature`, `overview`, `userStories[]`, `aiFeatures?`, `sprints[]` com `idx`, `name`, `objective`, `userStoryIds`, `dependsOn`, `complexity`, `keyFeatures`.
- **Escalação:** apenas `{ "escalationReason": "..." }` quando o pedido é vago de mais ou contraditório (ver exemplos de calibração).

Após o parse, o pipeline chama `normalizePlannerModelOutput` para injetar `runId` e `prompt`, derivar `id` estável por sprint, critérios de aceitação a partir das user stories e o resumo curto.

## Ferramentas (AI SDK)

O runner usa `generateText` com `stopWhen: stepCountIs(12)` e três ferramentas registadas:

| Ferramenta      | Função                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `readKB`        | Lê ficheiros sob a KB Maestro (caminhos relativos a `.maestro/`, p.ex. `AGENTS.md`) ou `docs/...` na raiz do repositório. |
| `listDirectory` | Lista ficheiros recursivamente até profundidade limitada (ignora `node_modules`, `.git`, `dist`).                         |
| `searchCode`    | Pesquisa literal com **ripgrep** (`rg`) no repositório; se `rg` não existir, devolve mensagem explícita.                  |

Os eventos `agent.tool_call` e `agent.tool_result` são emitidos no bus para a TUI.

## Calibração

O `plannerAgent` inclui `calibration.fewShotExamples` (cinco cenários em `packages/agents/src/planner/fixtures-data.ts`): tarefa fechada → um sprint, produto maior → vários sprints, escopo implícito, pedido vago → escalação, contradição → escalação. O texto resolvido do sistema (prompt + exemplos) está coberto por snapshot em `system-prompt.snapshot.test.ts`.

## Limitações

- A pesquisa de código é literal (ripgrep), não semântica.
- Leituras e listagens ficam restritas à raiz do repositório (sem `..`).
- O modelo deve responder com um único objeto JSON; reparação de JSON quase válido usa `jsonrepair` no runner.

## Relação com o Architect

O Planner define **o quê** (produto e sprints); o **Architect** valida o plano contra `ARCHITECTURE.md` e restrições técnicas na fase seguinte do pipeline.
