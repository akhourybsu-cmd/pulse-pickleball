# PULSE Placement — go-live runbook

Phase 1 ships the placement engine **gated off**. This runbook takes it live:
validate the SQL port against the tested TS oracle in **staging**, then enable +
recalculate in production. The enable/recalc SQL lives here (NOT in
`supabase/migrations/`) on purpose — migrations auto-apply on deploy, and the
all-user recalc must be a deliberate, post-validation step.

## Locked constants (validated by the tuning sweep)

| param | value |
|---|---|
| `placement_matches` | 5 |
| `provisional_matches` | 8 |
| `placement_prior_weight` | 1.0 |
| `placement_team_result_constant` | 0.20 |
| `placing_opponent_elo_multiplier` | 0.35 |
| `reliability_placing / provisional / established` | 0.50 / 0.75 / 1.00 |
| clamp | 2.0 – 4.5 |
| `placement_model_version` | 1 |

These are the migration defaults (`20260805170000`). If you changed them, set
them explicitly before recalc.

## Step 1 — Apply the gated migrations (safe; no behavior change)

`20260805170000_placement_scaffolding.sql` and
`20260805180000_placement_engine_gated.sql` apply on deploy. With
`placement_enabled = false` the rating output is **byte-identical** to today.

## Step 2 — Validate the SQL port in STAGING against the golden oracle

The oracle is `src/lib/rating/golden.ts` (locked in CI by `golden.test.ts`). A
focal player self-rated **3.00** plays 5 placement matches, partner + opponents
all established at **3.5**, scores `11-4, 11-6, 11-2, 9-11, 11-5`. Expected
focal `rating_after` per match:

| match | 1 | 2 | 3 | 4 | 5 (= placed_rating) |
|---|---|---|---|---|---|
| rating_after | **3.45** | **3.60** | **3.675** | **3.6036** | **3.653** |

On a staging DB, recreate that fixture (fill any NOT-NULL columns your schema
requires), then:

```sql
-- enable placement in staging only
UPDATE rating_parameters SET placement_enabled = true
 WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT public.recalculate_all_ratings();

-- focal player's per-match results — compare to the table above
SELECT m.match_date, mp.rating_after
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
 WHERE mp.player_id = '<focal id>'
 ORDER BY m.match_date;

-- placement outputs
SELECT placed_rating, placement_completed_at, placement_model_version
  FROM profiles WHERE id = '<focal id>';   -- expect placed_rating = 3.653
```

If the numbers match the table (to 4 dp), the PL/pgSQL port equals the tested
reference — proceed. If not, do **not** enable in production; the port diverged.

Also spot-check on real staging data: players with <5 rating matches gain a
`placed_rating`; established players' ratings barely move (protection working).

## Step 3 — Enable + recalculate in PRODUCTION (irreversible for the numbers)

Run once, off-hours. This recomputes **every** player's rating.

```sql
UPDATE rating_parameters SET placement_enabled = true
 WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT public.recalculate_all_ratings();
```

Because the whole history replays deterministically, this is safe to re-run.

## Rollback

Instant revert to the current ELO for everyone:

```sql
UPDATE rating_parameters SET placement_enabled = false
 WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT public.recalculate_all_ratings();
```

`placed_rating` / `placement_completed_at` are recomputed (cleared) on every
recalc, so a rollback leaves no placement residue.
