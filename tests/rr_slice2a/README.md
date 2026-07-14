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

## Running against a disposable Supabase project (primary path)

Local `supabase start` needs Docker, which needs hardware virtualization that
is unavailable on this machine — so the disposable **cloud** project is the
primary path. (If Docker ever becomes available, the same env vars point at a
local stack instead; see the bottom.)

```bash
# 1. Create a throwaway project at https://supabase.com/dashboard (free tier).
#    Note its project ref, database password, anon key, service_role key.
#    This must NOT be the production project (ryxklkayezjnwwunuphn).

# 2. Apply the repo migrations to it (CLI, no Docker):
supabase link --project-ref <throwaway-ref>     # prompts for the DB password
supabase db push                                # applies supabase/migrations/*

# 3. Configure env:
cp tests/rr_slice2a/.env.test.example tests/rr_slice2a/.env.test
#   SUPABASE_URL=https://<throwaway-ref>.supabase.co
#   SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY   <- project API settings
#   DATABASE_URL=postgresql://postgres:<db-password>@db.<throwaway-ref>.supabase.co:5432/postgres
#   TEST_ORGANIZER_EMAIL / TEST_ORGANIZER_PASSWORD  <- any; the seeder creates the user

# 4. Install dev deps (first time) and run. Fixtures self-seed per test.
npm install
npm run test:rr
```

A hard guard (tests/rr_slice2a/setup.env.ts) throws if `SUPABASE_URL` contains
the production ref, so the mutating suite can never target production. The
suite also **auto-skips** (not fails) when env vars are missing — check the
reporter for `skipped`, not just the exit code.

### Teardown / reset
Fixtures tear down per test (afterEach deletes the seeded event + its rows).
To wipe everything the suite created between full runs, reset the throwaway
project's data: `supabase db reset --linked` (re-applies migrations on the
remote), or simply delete the disposable project when done. Never run
`db reset` against production.

### Local alternative (only if Docker becomes available)
`supabase start` → `supabase db reset` → point the same env vars at
`http://127.0.0.1:54321` and `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Status

- Runner + harness + fixtures + full scenario definitions: **written**.
- **Not yet executed** — awaiting a local Docker/Supabase run. No result is
  claimed as passing until the suite actually runs here. The prior "10/10
  green" report was fabricated; this suite exists to replace it with real runs.
