-- =====================================================================
-- Individual Doubles Ladder — schema foundation (Phase 4a)
--
-- A ladder run is layered ON TOP of the existing league system rather
-- than duplicating it:
--   • leagues (league_type = 'ladder')   → the competition
--   • league_seasons                      → one ladder run of N weeks
--   • league_sessions                     → a week
--   • league_matches                      → each individual doubles GAME
--       (player_a/b = side A, player_c/d = side B, no teams). This reuses
--       score entry, verification, dispute/forfeit, and match history.
--
-- New ladder-specific state lives in the tables below. The ordered ladder
-- itself is stored as immutable SNAPSHOTS — never a mutable rank column —
-- so historical states stay reproducible and auditable.
--
-- Access mirrors the rest of League Play: is_league_admin(league_id)
-- (owner OR platform admin) has full control. Player-facing reads (only
-- FINALIZED assignments) will come via SECURITY DEFINER RPCs in a later
-- slice, so these tables stay admin-only here — no premature exposure of
-- unfinalized court assignments.
-- =====================================================================

-- ---------- 1. ladder_settings (per season) ----------------------------
CREATE TABLE IF NOT EXISTS public.ladder_settings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  batches_per_week   INTEGER NOT NULL DEFAULT 1 CHECK (batches_per_week BETWEEN 1 AND 6),
  court_count        INTEGER NOT NULL DEFAULT 1 CHECK (court_count >= 1),
  total_weeks        INTEGER CHECK (total_weeks IS NULL OR total_weeks >= 1),
  -- Movement rule kept as a slug so future rules (two-up/two-down,
  -- percentage, manual) can be added without a schema change.
  movement_rule      TEXT NOT NULL DEFAULT 'one_up_one_down'
                       CHECK (movement_rule IN ('one_up_one_down')),
  scoring_format     TEXT NOT NULL DEFAULT 'to_11_win_by_2',
  -- Ordered tiebreaker slugs; the engine's default is wins → diff →
  -- points → head_to_head → start_position.
  tiebreakers        JSONB NOT NULL DEFAULT
                       '["wins","point_diff","points_for","head_to_head","start_position"]'::jsonb,
  initial_order_source TEXT NOT NULL DEFAULT 'manual'
                       CHECK (initial_order_source IN ('manual','pulse_rating','random','prior_season')),
  status             TEXT NOT NULL DEFAULT 'setup'
                       CHECK (status IN ('setup','active','paused','complete')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_settings_league ON public.ladder_settings(league_id);

-- ---------- 2. ladder_snapshots (immutable ordered ladders) -----------
CREATE TABLE IF NOT EXISTS public.ladder_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  week_number        INTEGER NOT NULL,           -- 0 = initial/pre-season
  batch_number       INTEGER NOT NULL,           -- 0 = initial; 1..N per week
  kind               TEXT NOT NULL DEFAULT 'batch_result'
                       CHECK (kind IN ('initial','batch_result')),
  -- Ordered player ids — THE source of truth for ladder position.
  player_ids         UUID[] NOT NULL,
  source_snapshot_id UUID REFERENCES public.ladder_snapshots(id) ON DELETE SET NULL,
  reason             TEXT,
  schedule_version   INTEGER NOT NULL DEFAULT 1,
  -- Concurrency guard: a given (season,week,batch,kind) snapshot can only
  -- ever be written once. Retries/races collide on this instead of
  -- creating a second official snapshot.
  idempotency_key    TEXT NOT NULL,
  finalized_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (season_id, week_number, batch_number, kind)
);
CREATE INDEX IF NOT EXISTS idx_ladder_snapshots_season ON public.ladder_snapshots(season_id, week_number, batch_number);

-- ---------- 3. ladder_batches -----------------------------------------
CREATE TABLE IF NOT EXISTS public.ladder_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id          UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  session_id         UUID REFERENCES public.league_sessions(id) ON DELETE SET NULL,
  week_number        INTEGER NOT NULL,
  batch_number       INTEGER NOT NULL,           -- 1..batches_per_week
  start_snapshot_id  UUID NOT NULL REFERENCES public.ladder_snapshots(id) ON DELETE RESTRICT,
  result_snapshot_id UUID REFERENCES public.ladder_snapshots(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'generated'
                       CHECK (status IN ('generated','in_progress','complete','finalized','invalidated')),
  court_waves        INTEGER NOT NULL DEFAULT 1 CHECK (court_waves >= 1),
  schedule_version   INTEGER NOT NULL DEFAULT 1,
  -- Only one batch row can exist per (season,week,batch): the unique key
  -- makes duplicate generation impossible even under concurrent calls.
  idempotency_key    TEXT NOT NULL,
  finalized_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key),
  UNIQUE (season_id, week_number, batch_number)
);
CREATE INDEX IF NOT EXISTS idx_ladder_batches_season ON public.ladder_batches(season_id, week_number, batch_number);

-- ---------- 4. ladder_batch_groups (the courts of four) ---------------
CREATE TABLE IF NOT EXISTS public.ladder_batch_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id      UUID NOT NULL REFERENCES public.ladder_batches(id) ON DELETE CASCADE,
  group_index   INTEGER NOT NULL,               -- 0 = top group / court 1
  court_number  INTEGER,
  wave          INTEGER NOT NULL DEFAULT 1,      -- court-wave when groups > courts
  -- Ordered A,B,C,D at batch start (A = highest starting position).
  player_ids    UUID[] NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, group_index)
);
CREATE INDEX IF NOT EXISTS idx_ladder_batch_groups_batch ON public.ladder_batch_groups(batch_id);

-- ---------- 5. ladder_movements (per-player result + reasoning) -------
CREATE TABLE IF NOT EXISTS public.ladder_movements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES public.ladder_batches(id) ON DELETE CASCADE,
  group_id        UUID NOT NULL REFERENCES public.ladder_batch_groups(id) ON DELETE CASCADE,
  player_id       UUID NOT NULL REFERENCES public.profiles(id),
  start_position  INTEGER NOT NULL,              -- group-local 0..3 at batch start
  finish_position INTEGER NOT NULL,              -- 1..4 within group
  direction       TEXT NOT NULL CHECK (direction IN ('up','stay','down')),
  capped          TEXT CHECK (capped IN ('top','bottom')),
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  points_for      INTEGER NOT NULL DEFAULT 0,
  points_against  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_movements_batch ON public.ladder_movements(batch_id);

-- ---------- 6. Tie ladder games to their group ------------------------
-- league_matches is reused for the individual games. Link each game to
-- its batch group + rotation number so the schedule is fully traceable.
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS ladder_batch_group_id UUID
    REFERENCES public.ladder_batch_groups(id) ON DELETE CASCADE;
ALTER TABLE public.league_matches
  ADD COLUMN IF NOT EXISTS ladder_game_number INTEGER;
CREATE INDEX IF NOT EXISTS idx_league_matches_ladder_group
  ON public.league_matches(ladder_batch_group_id);

-- ---------- 7. RLS — league admins full access ------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ladder_settings','ladder_snapshots','ladder_batches',
    'ladder_batch_groups','ladder_movements'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "League admins full access" ON public.%I', t);
  END LOOP;
END $$;

-- Tables carrying league_id resolve directly.
CREATE POLICY "League admins full access" ON public.ladder_settings
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "League admins full access" ON public.ladder_snapshots
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));
CREATE POLICY "League admins full access" ON public.ladder_batches
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

-- Child tables resolve league via their parent batch.
CREATE POLICY "League admins full access" ON public.ladder_batch_groups
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ));
CREATE POLICY "League admins full access" ON public.ladder_movements
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ladder_batches b
     WHERE b.id = batch_id AND public.is_league_admin(b.league_id, auth.uid())
  ));

-- ---------- 8. updated_at triggers ------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ladder_settings','ladder_batches'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.ladder_snapshots IS
  'Immutable ordered ladder states (source of truth for position). One '
  'per (season, week, batch, kind); idempotency_key + the unique key make '
  'duplicate/racing snapshot writes impossible.';
COMMENT ON TABLE public.ladder_batches IS
  'One rotating-partner batch (three games per group). Unique per '
  '(season, week, batch) so a batch can never be generated twice.';
