# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Skill Atlas: a graph-backed app for exploring how skills, courses, and career roles connect. Data lives in **CognoDB** (openCypher over the Bolt protocol, accessed via the standard `neo4j-driver`) rather than a relational database — the core features (multi-hop prerequisite chains, skill-gap analysis, "bridge skill" discovery) are reachability/path questions that are natural in Cypher and awkward in SQL. See `README.md` for the full rationale, data model diagram, and annotated Cypher for all four main queries.

## Commands

Backend (`backend/`) — TypeScript, run natively by Node (no build step; requires Node ≥22.18 for stable type stripping):
```bash
npm install
cp .env.example .env    # fill in COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD
npm run seed             # loads seed data into the connected CognoDB instance
npm run dev               # node --watch src/server.ts, http://localhost:4000
npm start                  # node src/server.ts (no watch)
npm run typecheck           # tsc --noEmit — Node's runtime type-stripping does NOT type-check
```

Frontend (`frontend/`) — TypeScript + React 19 via Vite:
```bash
npm install
cp .env.example .env    # only needed if API isn't on localhost:4000
npm run dev               # vite dev server, http://localhost:5173
npm run build               # tsc -b && vite build (typecheck gates the build)
npm run typecheck            # tsc -b --noEmit
npm run preview
```

No test suite or linter is currently configured in either package.

## Architecture

**Backend** (`backend/src/`) is a thin three-file Express layer with no route-handler files despite the presence of an (empty) `routes/` directory — all endpoints are registered directly in `server.ts`. Runs as plain TypeScript directly via Node's native type stripping (`.ts` relative imports, `erasableSyntaxOnly` in `tsconfig.json`) — there is no `dist/`, `tsx`, or `ts-node` in this project.
- `db.ts` — creates the `neo4j-driver` instance from env vars, exposes `runQuery<T>(cypher, params)` (generic, always parameterized — never build Cypher via string concatenation), `verifyConnectivity()`, and `isConnected()`.
- `queries.ts` — every Cypher query the app runs, one exported function each, all parameterized and typed against `types.ts`.
- `types.ts` — shared row/DTO interfaces matching each query's Cypher `RETURN` shape; used to parameterize `runQuery<T>()`.
- `server.ts` — Express app, CORS, and route registration. A global middleware checks `isConnected()` on every request (except `/api/health`) and returns a clean `503` instead of letting a driver exception bubble up, so the DB-unreachable state is always explicit in the API response. Note: `/api/people/:name` throws a 404-flagged error on a missing person, but the `handle()` wrapper currently always responds `500` — a pre-existing bug, not yet fixed.
- `seed.ts` — loads the fixed seed dataset (32 skills, 31 prerequisite edges, 31 courses, 10 roles, 2 demo learners) into a fresh CognoDB instance.

**Frontend** (`frontend/src/`) is a Vite + React 19 app (TypeScript, `.tsx`/`.ts`) with client-side routing via `react-router` (the v7 package — `react-router-dom` was collapsed into it; import routing APIs from `'react-router'`, not `'react-router-dom'`):
- `types.ts` — DTOs mirroring the backend's `types.ts` (intentionally duplicated — no shared package between the two independent npm projects).
- `api.ts` — the only place that calls the backend; a thin generic `fetch` wrapper (`api.<method>`) around each endpoint, typed against `types.ts`, throwing `ApiError` (an `Error` subclass carrying `.status`) on failure. New backend routes should get a corresponding method here rather than calling `fetch` from components directly.
- `App.tsx` — top-level layout/nav, and a one-time `/api/health` check on mount that drives a connected/unreachable indicator.
- `components/AtlasPage.tsx`, `PathFinderPage.tsx`, `InsightsPage.tsx` — the three routed pages, corresponding to the three query groups in `queries.ts` (prerequisite chain, skill gap + learning path, bridge skills).
- `components/GraphCanvas.tsx` — force-directed SVG graph rendering (via `d3-force`, typed with `@types/d3-force`'s `SimulationNodeDatum`/`SimulationLinkDatum`) shared by the pages that visualize the graph.

**Data model** (see README for the full diagram): `Skill`, `Course`, `Role`, `Person` nodes; `PREREQUISITE_OF` (Skill→Skill), `TEACHES` (Course→Skill), `REQUIRES` (Role→Skill, weighted by `importance`), `HAS_SKILL` (Person→Skill), `COMPLETED` (Person→Course) relationships.

**Error handling convention**: the backend never lets a raw driver/connectivity error reach the client — it's always translated to a `503` (DB unreachable) or `500` with `{ error, detail }` JSON via the `handle()` wrapper in `server.ts`. The frontend's `api.ts` mirrors this by throwing an `ApiError` built from that `detail`/`error` field, and pages render the offline/error state explicitly rather than failing silently — preserve this pattern when adding new endpoints or pages.
