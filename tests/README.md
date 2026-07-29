# Integration test suites (staging only)

Three suites under `tests/` are **DB integration tests**. They are
`describe.skip`-gated on environment variables, so an ordinary `npm test`
(no env) runs the pure unit suites and safely **skips** all of these. Point
them at a **disposable staging Supabase project — never production.**

| Suite | Proves | Requires |
|-------|--------|----------|
| `tests/skill_security` | `skill-complete` is the only authoritative completion path; the client cannot forge a result | service role |
| `tests/skill_organizer` | organizer visibility is authorized + sanitized; reviews are private & non-mutating | service role |
| `tests/rr_slice2a` | Round Robin `rr_manage_participant` contract (unrelated to the assessment) | pre-seeded fixtures |

---

## Environment variables

### `skill_security` + `skill_organizer` (shared harness `tests/skill_shared/harness.ts`)

| Variable | Credential | Purpose |
|----------|-----------|---------|
| `SUPABASE_URL` | project URL | staging project endpoint |
| `SUPABASE_ANON_KEY` | **anon** (public) | anonymous + signed-in clients used for **all security assertions** |
| `SUPABASE_SERVICE_ROLE_KEY` | **service role** (secret) | fixture setup / inspection / teardown **only** |

All three must be present or both suites skip. The service-role key is read
from the environment and **never logged** (cleanup logs only opaque IDs on
best-effort failure). Do not commit these values or echo them in CI logs.

### `rr_slice2a` (pre-existing; harness `tests/rr_slice2a/harness.ts`)

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_ORGANIZER_EMAIL`,
`TEST_ORGANIZER_PASSWORD`, `TEST_PARTICIPANT_IDS`, `TEST_EVENT_ID`.

---

## Commands

```bash
# Pure unit suites only (default; integration suites auto-skip):
npm test

# Skill security suite (needs the three SUPABASE_* vars):
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx vitest run tests/skill_security

# Organizer visibility suite:
SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx vitest run tests/skill_organizer
```

When the variables are absent, both suites report as **skipped** (never
failed) — that is the expected local/CI-without-secrets state.

---

## Fixture isolation & cleanup

- **Unique per run.** Every user is created with a random email
  (`pulse-skilltest+<label>-<uuid>@example.com`) and random password via the
  service-role admin API; leagues get random names. Runs never collide and
  never depend on pre-existing rows.
- **Auth users → profiles.** Creating a user fires `handle_new_user`, which
  creates the `profiles` row the skill tables reference.
- **Security assertions use anon/authenticated clients only.** The
  service-role client is used strictly to *set up* and *inspect* fixtures, so
  a passing test reflects the real RLS + column-grant + SECURITY DEFINER
  boundary. The tests never weaken RLS or grants to run.
- **Cleanup (best-effort, FK-safe order).** `afterAll` deletes created
  **leagues first** (cascade removes members / reviews / audit rows), then
  deletes **users** (cascade removes profiles / attempts / responses / scores
  / evidence). Cleanup logs a warning and continues on error so one failure
  can't mask another. If a run is killed mid-way, orphaned rows are confined
  to the disposable staging project and identifiable by the
  `pulse-skilltest+` email prefix.

---

## Migration verification order (skill suites)

The hardening migration `20260729160000_skill_completion_authorization_hardening.sql`
closes a real bypass. Verify it in this order **against staging, not
production**:

1. Deploy the current branch to a dedicated **staging** Supabase project.
2. Apply the assessment foundation migration (`20260729123000_…`) if not present,
   plus `20260729140000_…` (organizer visibility).
3. Deploy the `skill-complete` Edge Function.
4. **Prove the normal completion flow works** — run `skill_security` scenario 1
   (it should pass). Scenarios 2/3/4-scoring/6-immutability are **expected to
   FAIL here** — that failure IS the reproduced exploit (client can self-finalize).
5. Apply `20260729160000_skill_completion_authorization_hardening.sql`.
6. **Prove the normal completion flow still works** — scenario 1 still passes
   (validates the service-role/definer bypass assumption).
7. Run **all** `skill_security` scenarios — the previously-failing forgery
   scenarios now **pass** (exploit rejected).
8. Run **all** `skill_organizer` scenarios.
9. Re-run the full local unit suite (`npm test`) and `npm run build`.

Do **not** demonstrate the exploit against production. Reproduce it only on the
disposable staging project, between steps 4 and 5.
