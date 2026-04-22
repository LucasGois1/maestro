# AGENTS

## Header

Project: Python (FastAPI) — greenfield template
Stack: Python 3.12+, FastAPI, Maestro v0.1
Version: Maestro v0.1

## Repo Map

- `app/` — API routes and dependencies
- `tests/` — pytest suite

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Product Specs](./docs/product-specs/index.md)
- [Exec Plans](./docs/exec-plans/tech-debt-tracker.md)
- [Golden Principles](./docs/golden-principles/index.md)

## Essential Commands

- install: `pip install -e ".[dev]"` or `uv sync`
- test: `pytest`
- build: N/A
- run: `uvicorn app.main:app --reload`

## Critical Conventions

- Use Pydantic models for request/response schemas.
- Keep routes thin; business logic in services.

## Escalation Path

- Stop and ask a human before changing deployment or secrets.
