# AGENTS

## Header

Project: Node.js (Next.js) — greenfield template
Stack: TypeScript, Next.js App Router, Maestro v0.1
Version: Maestro v0.1

## Repo Map

- `app/` — Next.js routes and layouts
- `components/` — React UI

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Product Specs](./docs/product-specs/index.md)
- [Exec Plans](./docs/exec-plans/tech-debt-tracker.md)
- [Golden Principles](./docs/golden-principles/index.md)

## Essential Commands

- install: `pnpm install`
- test: `pnpm test`
- build: `pnpm build`
- run: `pnpm dev`

## Critical Conventions

- Prefer Server Components unless client state is required.
- Colocate tests next to modules where practical.

## Escalation Path

- Ask a human before changing auth, billing, or infra secrets.
