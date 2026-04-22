# Doc Gardener (background)

O agente **Doc Gardener** (`id: doc-gardener`, `role: background`) mantém a higiene da documentação e sinaliza deriva de código e dependências. A execução típica é pela CLI; o modelo pode ser omitido com `--skip-llm` para um modo só com heurísticas e ferramentas.

## Invocação (CLI)

```bash
maestro background run [--type doc|code|all] [--skip-llm] [--skip-pr]
```

| Opção | Significado |
| --- | --- |
| `--type` | `doc`: apenas verificações de docs; `code`: duplicação + Knip + `pnpm outdated`; `all`: ambos (predefinição). |
| `--skip-llm` | Não chama o modelo; relatório com heurísticas e ferramentas. |
| `--skip-pr` | Não cria ramos nem abre PRs (útil em CI ou sem `gh`/`glab`). |

### Guarda de pipeline

Se existir um run Maestro com `status: running` no armazenamento de estado do projecto (`.maestro/`), o comando aborta com mensagem clara e código de saída **2** (não interrompe runs ativas).

### Códigos de saída

| Código | Situação |
| --- | --- |
| `0` | Nenhum problema contabilizado (`issuesFound === 0`). |
| `1` | Foram encontrados problemas (`issuesFound > 0`) ou erro de opções/configuração inválida. |
| `2` | Pipeline principal ainda em execução (guarda). |

## Configuração (`background` em `.maestro/config.json`)

| Campo | Predefinição | Descrição |
| --- | --- | --- |
| `background.knip` | `true` | Correr `pnpm exec knip --reporter json` em `runType` `code` ou `all`. |
| `background.outdated` | `true` | Correr `pnpm outdated` (formato condensado) em `runType` `code` ou `all`. |
| `background.maxFindingsPerSource` | `80` | Teto de entradas por fonte (Knip / outdated) no relatório. |

## Relatório

O orquestrador escreve um ficheiro Markdown em:

`.maestro/docs/background-reports/<timestamp-iso>.md`

Secções típicas: **Doc hygiene**, **Duplicate snippets**, **Knip**, **Outdated dependencies**, **Agent notes** (se o LLM correu), **PRs** (se PRs foram ignorados por working tree suja).

O caminho relativo ao repositório (`reportPath`) coincide com o contrato JSON do agente.

## Contagem `issuesFound` e `breakdown`

- **`issuesFound`** = `max(heurísticas totais, issues reportadas pelo LLM)`, para não inflar quando o modelo também reporta números.
- Heurísticas totais = soma dos comprimentos das listas: doc + duplicação + Knip + outdated (conforme `runType` e flags).
- O output JSON pode incluir **`breakdown`**: `docHygiene`, `codeDuplicate`, `knip`, `outdated`, `llmReported` (opcional).

## Heurísticas e ferramentas

### Documentação

- Links Markdown relativos quebrados (`.maestro/AGENTS.md`, `ARCHITECTURE.md`, `docs/**/*.md`); aviso se `AGENTS.md` excede ~150 linhas.
- Destinos que são **pastas** existentes contam como válidos (`stat` em ficheiro ou directório).

### Código (heurística local)

- Amostra de `.ts`/`.tsx` via `git ls-files`; blocos duplicados entre pares de ficheiros (limitado).

### Knip

- Comando: `pnpm exec knip --reporter json --no-progress` na raiz do repositório alvo.
- Recomenda-se um `knip.json` no projecto; o Knip pode reportar falsos positivos em re-exports (`*`) — ajuste com `ignore` / `ignoreDependencies`.
- Requer Knip como dependência de desenvolvimento do **projecto analisado** (ou na raiz do monorepo).

### Dependências desactualizadas

- Comando: `pnpm outdated` (saída condensada `pacote: atual → novo`).
- Alinhado a monorepos **pnpm** (`packageManager` / lockfile).

## Pull requests (uma por categoria)

Quando há achados e **não** se passa `--skip-pr`, o fluxo tenta abrir até **dois** PRs separados:

| Categoria | Label extra típico |
| --- | --- |
| Problemas de documentação | `doc-fix` |
| Duplicação, Knip ou outdated | `code-cleanup` |

Os PRs incluem sempre `maestro` e `background`. O branch base do PR segue o **default de `origin`** (`git symbolic-ref refs/remotes/origin/HEAD` ou `main`/`master`).

### Working tree limpa

Se o repositório não estiver limpo (`git status --porcelain`), **nenhum** PR é aberto; o relatório indica o motivo.

## Contrato de output (resumo)

`gardenerOutputSchema`: `runType`, `issuesFound`, `prsOpened[]`, `reportPath`, `breakdown` (opcional). URLs em `prsOpened` são preenchidas pelo orquestrador quando os PRs são criados com sucesso.

## Limitações

- Não há agendamento integrado (`cron`); use um scheduler externo se precisarem de execução periódica.
- Knip e `pnpm outdated` podem ser ruidosos ou lentos; use `maxFindingsPerSource` e `knip.json`.
- Violações de camadas entre pacotes não são verificadas automaticamente salvo convenção no repo (ex.: dependency-cruiser no futuro); o LLM + `runSensor` + `ARCHITECTURE.md` cobrem parte do raciocínio.

## Dependências

- Config Maestro válida (`.maestro/config.json`).
- **pnpm** no PATH do projecto analisado.
- Para PRs: remoto `origin`, working tree limpa, `gh`/`glab` disponíveis.
