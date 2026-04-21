# ARCHITECTURE

## Bird's Eye View
FastAPI service with a layered layout: routing, domain logic, and persistence boundaries kept explicit.

## Code Map
- `app/` — FastAPI application, routers, schemas
- `tests/` — pytest tests mirroring package layout

## Cross-Cutting Concerns
- Validation via Pydantic; structured logging; HTTP errors mapped to problem responses.

## Module Boundaries
- Routers depend on services; services depend on interfaces/adapters; avoid cycles.

## Data Flow
HTTP request → router → service → store/external API → response.
