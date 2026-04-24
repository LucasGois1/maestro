# Agente Planner (DSFT-90, DSFT-123)

O **Planner** agora tem duas responsabilidades sequenciais:

1. **Entrevista iterativa obrigatória** sobre requisitos, restrições, fluxos, regras de negócio e escopo.
2. **Planeamento final** em sprints, depois de o resumo consolidado ser revisto pelo utilizador.

O resultado continua a ser JSON validado por `plannerModelOutputSchema` em `@maestro/agents`, mas o agente já não responde apenas com um plano ou uma escalação. Durante a fase inicial, pode devolver rodadas de perguntas, gate de continuação e resumo consolidado. Só no fim o pipeline normaliza para `PlannerOutput` e grava `plan.md` em `.maestro/runs/<runId>/plan.md`.

## Entrada

- Corpo base: `{ "prompt": "<texto do utilizador>" }`.
- Opcionalmente, `plannerInputSchema` aceita:
  - `interview` — estado acumulado da entrevista (transcript, respostas recentes, contexto estruturado, round counters e stage).
  - `replan` — contexto de replan do Architect (igual ao fluxo anterior).

## Saída

- **`kind: "questions"`** — próxima rodada de entrevista, com até 10 perguntas textuais (`id`, `prompt`, `topic`) e `interviewState`.
- **`kind: "continue_gate"`** — pedido para o utilizador decidir se continua a aprofundar depois de esgotar o bloco de 10 rodadas.
- **`kind: "summary"`** — resumo consolidado em markdown para revisão humana antes do plano.
- **`kind: "plan"`** — plano completo: `feature`, `overview`, `userStories[]`, `aiFeatures`, `sprints[]`.
- **`kind: "escalation"`** — reservado a contradições ou impossibilidades reais.

O pipeline só chama `normalizePlannerModelOutput` quando o output já está em `kind: "plan"`. Antes disso, persiste o estado da entrevista em `.maestro/runs/<runId>/planning/` e pausa a run à espera de input humano.

## Ferramentas (AI SDK)

O runner usa `generateText` com `stopWhen: stepCountIs(12)` e três ferramentas registadas:

| Ferramenta      | Função                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `readKB`        | Lê ficheiros sob a KB Maestro (caminhos relativos a `.maestro/`, p.ex. `AGENTS.md`) ou `docs/...` na raiz do repositório. |
| `listDirectory` | Lista ficheiros recursivamente até profundidade limitada (ignora `node_modules`, `.git`, `dist`).                         |
| `searchCode`    | Pesquisa literal com **ripgrep** (`rg`) no repositório; se `rg` não existir, devolve mensagem explícita.                  |

Os eventos `agent.tool_call` e `agent.tool_result` são emitidos no bus para a TUI.

## Protocolo de entrevista

- A entrevista é **obrigatória** para a planificação inicial.
- O Planner pode emitir várias perguntas por rodada, mas a TUI mostra uma de cada vez.
- Cada bloco permite até 10 rodadas; ao chegar ao limite, o agent devolve `continue_gate`.
- Depois de o contexto estar suficientemente definido, o agent devolve `summary`.
- Se o utilizador aprovar o resumo (feedback vazio), o próximo output esperado é `kind: "plan"`.
- Replans do Architect continuam a saltar a entrevista e pedem `kind: "plan"` diretamente.

## Calibração

O `plannerAgent` inclui `calibration.fewShotExamples` (cinco cenários em `packages/agents/src/planner/fixtures-data.ts`): tarefa fechada → um sprint, produto maior → vários sprints, escopo implícito, pedido vago → entrevista inicial, contradição → escalação. O texto resolvido do sistema (prompt + exemplos) está coberto por snapshot em `system-prompt.snapshot.test.ts`.

## Limitações

- A pesquisa de código é literal (ripgrep), não semântica.
- Leituras e listagens ficam restritas à raiz do repositório (sem `..`).
- O modelo deve responder com um único objeto JSON; reparação de JSON quase válido usa `jsonrepair` no runner.
- O estado estruturado da entrevista vive no payload do Planner e é também persistido em artefactos de run; não existe ainda um schema partilhado entre `@maestro/agents` e `@maestro/state`.

## Relação com o Architect

O Planner continua a definir **o quê** (produto e sprints), mas agora só depois de negociar contexto suficiente com o utilizador. O **Architect** valida o plano contra `ARCHITECTURE.md` e restrições técnicas na fase seguinte do pipeline.
