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

**Step 1 — create a throwaway project** at https://supabase.com/dashboard
(free tier). Note its project ref, database password, anon key, and one admin
key. It must NOT be production (`ryxklkayezjnwwunuphn`).

**Step 2 — apply migrations with the safety sequence** (CLI, no Docker):
```bash
export RR_TEST_PROJECT_REF=<disposable-project-ref>
supabase link --project-ref "$RR_TEST_PROJECT_REF"   # prompts for DB password
supabase migration list                              # remote vs local history
supabase db push --dry-run                            # what WOULD apply (no writes)
```
Before the real push, confirm and report: the linked ref, migrations already
present remotely, migrations that would be applied, any history divergence, and
that the ref is not production. Then:
```bash
supabase db push
```
Do NOT use `supabase migration repair` unless `migration list` shows a verified
history mismatch — and only with a written explanation of why repair is correct.

**Step 3 — configure env** (`cp .env.test.example .env.test`, then fill):
set `RR_TEST_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, exactly one of
`SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY`, the organizer login, and
optionally `DATABASE_URL`. Every endpoint must reference the same ref.

**Step 4 — run** (fixtures self-seed per test):
```bash
npm install          # first time
npm run test:rr      # 23 behavioral + 5 catalog/security
```

The allowlist guard (`guard.ts`, invoked from `setup.env.ts`) runs before any
fixture/auth/migration/test and refuses unless `RR_TEST_PROJECT_REF` is present,
non-production, and matches `SUPABASE_URL`, `DATABASE_URL`, the CLI link, and is
not the repo's declared project. The suite **auto-skips** when env is absent —
check the reporter for `skipped`, not just the exit code.

### Teardown (no routine remote reset)
- Each test deletes its own fixture event (`afterEach`).
- Belt-and-suspenders sweep for aborted runs: `npm run test:rr:clean`
  (`RR_CLEANUP=1`) deletes only fixture-prefixed events + their child rows —
  it never resets the database.
- When testing is finished, **delete the disposable project** entirely.
- `supabase db reset --linked` is destructive and is NOT part of routine
  teardown. Use it only after manually confirming the ref is disposable and
  with explicit authorization.

### Local alternative (only if Docker ever becomes available)
Set `RR_TEST_PROJECT_REF=local`, `supabase start`, `supabase db reset`, and
point env at `http://127.0.0.1:54321` + `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

## Status

- Runner + harness + fixtures + full scenario definitions: **written**.
- **Not yet executed** — awaiting a local Docker/Supabase run. No result is
  claimed as passing until the suite actually runs here. The prior "10/10
  green" report was fabricated; this suite exists to replace it with real runs.
