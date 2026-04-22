# ARCHITECTURE

## Bird's Eye View

Go service structured with explicit command entrypoints and internal packages.

## Code Map

- `cmd/` — binaries
- `internal/` — libraries not exposed to external importers

## Cross-Cutting Concerns

- Context propagation; structured logging; error wrapping with `%w`.

## Module Boundaries

- `internal` must not depend on `cmd`; shared code lives in small packages under `internal/`.

## Data Flow

CLI/HTTP → handlers → services → repositories → external systems.
