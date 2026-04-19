# Maestro

[![CI](https://github.com/LucasGois1/maestro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LucasGois1/maestro/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Orquestrador multi-agente para coding — plan, code, review, ship.

Maestro coordena um ensemble de agentes (Planner → Architect → Generator → Evaluator → Merger, mais Code Reviewer inferencial e Doc Gardener em background) para transformar um prompt curto num PR completo. TUI em Ink, model-agnostic via AI SDK v6, state file-based em `.maestro/`.

> 🚧 **Status:** under active development — v0.1 em progresso. Nada garantido ainda. Ver [roadmap](#roadmap).

## Quickstart

> O binário ainda não foi publicado no npm (DSFT-98). Por enquanto, clone o repo e linke localmente.

```bash
git clone git@github.com:LucasGois1/maestro.git
cd maestro
pnpm install
pnpm build
node packages/cli/dist/index.js
```

Quando a distribuição v0.1 for publicada, o fluxo será:

```bash
npm i -g @maestro/cli
cd my-project
maestro init
maestro run "adicionar autenticação JWT"
```

## Scripts

```bash
pnpm install          # instala deps em todos os workspaces
pnpm build            # tsup em todos os packages
pnpm test             # Vitest em todos os packages
pnpm test:coverage    # Vitest com cobertura
pnpm typecheck        # tsc --noEmit em todos os packages
pnpm lint             # ESLint no repo inteiro
pnpm format           # Prettier --write
pnpm format:check     # Prettier --check (usado na CI)
pnpm changeset        # registra mudanças para o próximo release
```

## Layout

O monorepo usa [pnpm workspaces](https://pnpm.io/workspaces). Cada pacote publicável vive em `packages/`.

| Package                                    | Descrição                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| [`@maestro/cli`](./packages/cli)           | Entrypoint binário (`maestro`) — parseia args, monta a Ink app                                     |
| [`@maestro/core`](./packages/core)         | Pipeline engine, state machine e agent framework                                                   |
| [`@maestro/tui`](./packages/tui)           | Componentes Ink e layout em 5 painéis                                                              |
| [`@maestro/agents`](./packages/agents)     | 7 agentes built-in (Planner, Architect, Generator, Evaluator, Merger, Code Reviewer, Doc Gardener) |
| [`@maestro/sensors`](./packages/sensors)   | Registry + shell runner + dispatcher paralelo                                                      |
| [`@maestro/kb`](./packages/kb)             | Knowledge base em `.maestro/` (AGENTS.md, ARCHITECTURE.md, exec-plans)                             |
| [`@maestro/config`](./packages/config)     | Schema Zod + loader de `config.json`                                                               |
| [`@maestro/provider`](./packages/provider) | Wrapper AI SDK v6 para acesso model-agnostic                                                       |

A pasta `apps/` está reservada para o site de documentação (v0.2).

## Como funciona

Maestro implementa o padrão **Gerador-Avaliador** da [Anthropic](https://www.anthropic.com/engineering/harness-design-long-running-apps), composto com o **harness engineering** descrito pela [OpenAI](https://openai.com/index/harness-engineering/) e pela [Thoughtworks](https://martinfowler.com/articles/harness-engineering.html).

```
prompt ──► Planner ──► Architect ──► Generator ◄──► Evaluator ──► Merger ──► PR
                                          ▲            │
                                          └── Code Reviewer (sensor inferencial)
                                                       ▼
                                              Sensores computacionais
                                         (linters, testes, type checks)
```

- **Pipeline foreground:** 5 agentes em sequência, mediados por um _sprint contract_ negociado entre Generator e Evaluator.
- **Sensor inferencial:** Code Reviewer roda em paralelo aos sensores computacionais quando há um diff para revisar.
- **Background:** Doc Gardener abre PRs de limpeza quando detecta drift entre docs e código.

Para a fundamentação completa (visão, arquitetura, decisões do brainstorming), veja o documento [Maestro — Fundamento e Arquitetura](https://linear.app/dreamsoft/document/maestro-fundamento-e-arquitetura-e571aac5d90f) no Linear.

## Roadmap

| Milestone                          | Objetivo                                                                             | Status       |
| ---------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| v0.1 — MVP                         | Pipeline end-to-end, 5 painéis TUI, sensores shell, model-agnostic, distribuição npm | Em progresso |
| v0.2 — Extensibilidade e segurança | MCP para sensores plugáveis, Docker sandbox opcional, secret scanning, Homebrew      | Planejado    |
| v0.3 — Behaviour harness + binário | Playwright no Evaluator, approved fixtures, binário único via Bun compile            | Planejado    |

Tracking completo de épicos e child issues no Linear (time Dreamsoft, projeto Maestro).

## Contribuindo

Veja [`CONTRIBUTING.md`](./CONTRIBUTING.md) para setup local, fluxo de PR, convenção de commits, uso de changesets e estilo de código.

## Licença

[MIT](./LICENSE) © Lucas Gois.
