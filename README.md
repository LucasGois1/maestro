# Maestro

[![CI](https://github.com/LucasGois1/maestro/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/LucasGois1/maestro/actions/workflows/ci.yml)

> Multi-agent coding orchestrator — plan, code, review, ship.

Maestro coordena um ensemble de agentes (Planner → Architect → Generator → Evaluator → Merger, mais Code Reviewer e Doc Gardener) para transformar um prompt curto em um PR completo. TUI em Ink, model-agnostic via AI SDK v6.

> Status: **v0.1 em desenvolvimento ativo.** Nada garantido ainda.

## Scripts

```bash
pnpm install          # instala deps de todos os packages
pnpm lint             # ESLint em todo o workspace
pnpm format:check     # verifica Prettier
pnpm typecheck        # tsc --noEmit em cada package
pnpm test             # Vitest em cada package
pnpm build            # tsup em cada package
```

## Layout

```
packages/
├── cli/        # @maestro/cli — entrypoint binário
├── core/       # pipeline engine, state machine, agent framework
├── tui/        # componentes Ink
├── agents/     # 7 agentes built-in
├── sensors/    # registry + shell runner
├── kb/         # .maestro/ knowledge base
├── config/     # schema Zod + loader
└── provider/   # wrapper AI SDK v6
```

## Referências

- [Maestro — Fundamento e Arquitetura](https://linear.app/dreamsoft/document/maestro-fundamento-e-arquitetura-e571aac5d90f) (Linear)
