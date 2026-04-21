# ARCHITECTURE

## Bird's Eye View
Next.js application using the App Router with React Server Components by default.

## Code Map
- `app/` — routes, layouts, server actions
- `components/` — shared UI
- `public/` — static assets

## Cross-Cutting Concerns
- Env via `process.env` with validation; error boundaries; logging through a single helper.

## Module Boundaries
- UI components avoid importing server-only modules into client files marked with `use client`.

## Data Flow
Request → Next handler / RSC → data layer → render → response.
