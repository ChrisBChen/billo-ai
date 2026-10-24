# Billo

Mobile-first bill splitting for friends at the table, with receipt extraction and external payment handoffs.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (use its managed workflow for the assigned PORT)
- `pnpm --filter @workspace/billo run dev` — frontend (use its managed workflow to supply PORT and BASE_PATH)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Receipt scanning uses Replit AI Integrations for OpenAI. Credentials are managed in Secrets, never in client code.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/billo/` — real app, served at `/`.
- `artifacts/mockup-sandbox/src/components/mockups/split/` — preserved visual prototype, not the real application.
- `lib/api-spec/openapi.yaml` — API contract and generated clients.
- `lib/db/src/schema/bills.ts` — durable bills and participant sessions.
- `artifacts/api-server/src/lib/billo-domain.ts` — integer-cent allocations, validation and finalization.
- `artifacts/api-server/src/routes/billo.ts` — bill, join, mutation and receipt-scan routes.

## Architecture decisions

- No signup is intentional: private HttpOnly session cookies authorize each browser's participation. A shared invitation must never grant payer access.
- Receipt images are sent transiently to the AI provider for extraction, not saved by Billo. Store extracted data only after review.
- A finalized bill is immutable apart from participants' self-reported paid status. External payments cannot be reversed by editing a bill.
- Polling keeps participant views current; do not substitute local-only state for shared bill mutations.

## Product

Receipt camera/upload/manual entry, equal and itemized splitting, dollar/percentage/unit sharing, link and QR invitations, payer finalization, Venmo handoff, Zelle copyable details, and self-reported payment tracking.

## User preferences

See `.agents/memory/product-scope.md` for product intent and constraints.

## Gotchas

- Zelle runs inside participating banks; do not invent a universal prefilled Zelle app link.
- Venmo custom-scheme behavior depends on device and app installation. Keep web and copy fallbacks, and never treat opening a link as a confirmed payment.
- API request bodies carry bill revisions. A 409 means another participant changed the bill; refresh before retrying.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
