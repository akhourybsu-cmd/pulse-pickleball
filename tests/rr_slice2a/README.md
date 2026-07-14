# Slice 2a integration suite (`rr_manage_participant`)

Exercises the participant-management RPC end-to-end against a **real** Supabase
instance. The RPC reads `auth.uid()` for authorization/audit/ledger, so it
cannot be tested from a SQL migration `DO` block — these run as a signed-in
organizer via `supabase-js`, plus direct-Postgres catalog assertions.

**Never run against production** (`ryxklkayezjnwwunuphn`). The harness refuses
that project ref and auto-skips when env is absent.

## Layout

| File | Purpose |
|------|---------|
| `harness.ts` | env reader, anon/admin/signed-in clients, RPC caller, structured `errorCode()`, event snapshot + `assertNoWrites` |
| `fixtures.ts` | service-role seeder: disposable event + 5-player roster + round-1 match, with teardown |
| `scenarios.spec.ts` | behavioral contract (auth, transitions, active-match resolution, guests, restore, idempotency, concurrency, regen escalation) — fresh event per test |
| `security.spec.ts` | catalog/security via direct Postgres (`prosecdef`, owner, `search_path`, execute-grant matrix, counted-view definition) |
| `db.ts` | `pg` connection from `DATABASE_URL` (local only) |
| `setup.env.ts` | loads `.env.test` before the suite |

## Running locally (recommended)

Requires Docker (for `supabase start`).

```bash
# 1. Boot the local stack + apply all migrations
supabase start
supabase db reset            # applies supabase/migrations/* into the local db

# 2. Configure env (copy + fill from `supabase start` output)
cp tests/rr_slice2a/.env.test.example tests/rr_slice2a/.env.test
#   SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY  <- from `supabase start`
#   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres  <- for security.spec
#   TEST_ORGANIZER_EMAIL / TEST_ORGANIZER_PASSWORD  <- any; the seeder creates the user

# 3. Install dev deps (first time) and run
npm install
npm run test:rr
```

The suite **auto-skips** (not fails) when env vars are missing, so a bare
`npm test` on a machine without a configured local stack is green-by-skip —
check the reporter for `skipped`, not just the exit code.

## Status

- Runner + harness + fixtures + full scenario definitions: **written**.
- **Not yet executed** — awaiting a local Docker/Supabase run. No result is
  claimed as passing until the suite actually runs here. The prior "10/10
  green" report was fabricated; this suite exists to replace it with real runs.
