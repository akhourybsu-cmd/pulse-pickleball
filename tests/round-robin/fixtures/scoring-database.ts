import { readFileSync } from 'node:fs';
import { createRoundRobinDatabase } from './database';
import { installMatchEffects } from './match-effects';

export async function createScoringDatabase() {
  const db = await createRoundRobinDatabase();
  await db.exec(`
    ALTER TABLE round_robin_events ADD location text, ADD date timestamptz DEFAULT '2026-10-03', ADD rating_type text DEFAULT 'league', ADD completed_at timestamptz;
    ALTER TABLE profiles ADD initial_self_rating numeric DEFAULT 3.5, ADD current_rating numeric DEFAULT 3.5, ADD week_start_rating numeric, ADD week_start_date date, ADD total_matches integer DEFAULT 0, ADD wins integer DEFAULT 0, ADD losses integer DEFAULT 0, ADD total_points_for integer DEFAULT 0, ADD total_points_against integer DEFAULT 0, ADD updated_at timestamptz;
    CREATE TABLE courts(id uuid PRIMARY KEY, name text);
    CREATE TABLE matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, verification_status text, voided boolean DEFAULT false, count_for_rating boolean DEFAULT true,
      team1_score integer NOT NULL CHECK(team1_score>=0), team2_score integer NOT NULL CHECK(team2_score>=0), CHECK(abs(team1_score-team2_score)>=2),
      match_date timestamptz, created_at timestamptz DEFAULT now(), week_start date DEFAULT '2026-09-28', match_type text DEFAULT 'league',
      created_by uuid, source text, round_no integer, court_no integer, court_id uuid, other_location text, verified_by uuid[]);
    CREATE TABLE match_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_id uuid REFERENCES matches ON DELETE CASCADE,player_id uuid REFERENCES profiles,guest_player_id uuid,team integer,rating_before numeric,rating_after numeric,rating_change numeric);
    CREATE TABLE match_approvals(id uuid DEFAULT gen_random_uuid(),match_id uuid,player_id uuid,approved boolean);
    CREATE FUNCTION get_week_start(date) RETURNS date LANGUAGE sql AS $$ SELECT date_trunc('week',$1)::date $$;
  `);
  await installMatchEffects(db);
  await db.exec(readFileSync('supabase/migrations/20260618010300_prevent_duplicate_match_insert.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260709215814_c8952a59-7763-4fcf-8f7c-0f9e7365c9cd.sql','utf8').replace('v_event.organizer_id <> v_user_id','NOT public.can_manage_round_robin(v_event.id,v_user_id)'));
  await db.exec(readFileSync('supabase/migrations/20260915100000_atomic_round_robin_round_completion.sql','utf8').replace('v_event.organizer_id IS DISTINCT FROM v_actor','NOT public.can_manage_round_robin(v_event.id,v_actor)'));
  await db.exec(readFileSync('supabase/migrations/20261003160000_round_robin_scoring_lifecycle.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261003160000_round_robin_scoring_lifecycle.sql','utf8')); // replay-safe migration
  return db;
}
