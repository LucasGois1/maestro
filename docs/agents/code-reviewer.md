# Agente Code Reviewer (DSFT-95)

Único agente inferencial com `role: 'sensor'` no MVP v0.1. Corre quando o Evaluator (ou a tool `runSensor`) dispara um sensor `kind: inferential` com `agent: code-reviewer`. Revisa o **diff unificado** do sprint e devolve JSON validado por `codeReviewOutputSchema`.

## Entrada (`codeReviewInputSchema`)

- `diff` — diff unificado (obrigatório).
- `sprintContract` — texto do contrato do sprint (markdown); vazio se não aplicável.
- `goldenPrinciples` — lista de excertos (p.ex. conteúdo de `.maestro/docs/golden-principles/index.md` como um bloco).
- `agentsMd` — conteúdo de `.maestro/AGENTS.md` (ou vazio).

Quando o sensor é executado via tool `runSensor` no Evaluator, o pipeline injeta `codeDiff` e `sprintContract` a partir do input do Evaluator; `executeRunSensorTool` tenta ainda ler `AGENTS.md` e golden principles sob `.maestro/` se não forem passados explicitamente.

## Saída (`codeReviewOutputSchema`)

O schema Zod vive em `@maestro/sensors` (partilhado com o runner) e é re-exportado por `@maestro/agents` para consumo pela API pública.

- `violations[]`: `severity` (`info` | `warning` | `error`), `category` (`smell` | `security` | `style` | `testing` | `convention`), `file`, `line?`, `message`, `suggestion?`.
- `summary` — texto curto.
- `pass` — `true` quando **não** há violações com `severity: "error"` (avisos não bloqueiam o boolean).

No pacote `@maestro/sensors`, severidades são normalizadas para `info` | `warn` | `error` (`warning` → `warn`); `file` mapeia para `path` em `Violation`.

## Sensor Registry (`sensors.json`)

Exemplo:

```json
{
  "id": "code-review",
  "kind": "inferential",
  "agent": "code-reviewer",
  "onFail": "warn",
  "appliesTo": ["**/*.{py,ts,tsx,js,jsx,go,rs,java}"]
}
```

Sensores **inferenciais** usam `onFail: "warn"` por defeito no schema (sobrescrevível para `"block"`). Com `warn`, falhas lógicas do review mapeiam para estado `warned` em vez de `failed`.

## Semântica `pass` e `onFail`

- Se existir violação `error` ou `pass: false`, o resultado lógico falha; o estado final do sensor depende de `onFail` (`block` → `failed`, `warn` → `warned`).
- Apenas `info` / `warning` com `pass: true` ⇒ sensor `passed`, com violações listadas para o Evaluator.

## Calibração

Sete cenários em `packages/agents/src/code-reviewer/fixtures-data.ts` (incluindo ceticismo: bug sutil, erros engolidos). Snapshot em `packages/agents/src/code-reviewer/system-prompt.snapshot.test.ts`.

## Dependências

Agent framework, Sensor Registry, KB (AGENTS.md + golden principles em `.maestro/`).
