# AGENTS

## Header
Project: Go service — greenfield template
Stack: Go 1.22+, Maestro v0.1
Version: Maestro v0.1

## Repo Map
- `cmd/` — main packages
- `internal/` — implementation

## Docs
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Product Specs](./docs/product-specs/index.md)
- [Exec Plans](./docs/exec-plans/tech-debt-tracker.md)
- [Golden Principles](./docs/golden-principles/index.md)

## Essential Commands
- install: `go mod download`
- test: `go test ./...`
- build: `go build ./...`
- run: `go run ./cmd/...`

## Critical Conventions
- Keep `internal/` for non-importable packages; public APIs under `pkg/` if needed.

## Escalation Path
- Ask a human before changing wire formats or production endpoints.
