import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
export async function createRoundRobinDatabase() {
  const db=new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa',true),'true')='true' $$;
    CREATE TYPE rr_participant_status AS ENUM ('active','removed','replaced','withdrawn','injured');
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5($1),'hex') $$;
    CREATE TYPE app_role AS ENUM ('admin','player');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY,organizer_id uuid,status text DEFAULT 'draft',current_round integer DEFAULT 1,
      num_courts integer DEFAULT 4,num_rounds integer DEFAULT 1,games_per_player integer DEFAULT 4,schedule_version integer DEFAULT 0,
      voided boolean DEFAULT false,format text DEFAULT 'open',group_id uuid,rating_eligible boolean DEFAULT false,updated_at timestamptz,rating_exclusion_reason text);
    CREATE FUNCTION can_manage_round_robin(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM round_robin_events WHERE id=$1 AND organizer_id=$2) $$;
    CREATE TABLE group_members(group_id uuid,user_id uuid,role text,status text);
    CREATE TABLE profiles(id uuid PRIMARY KEY,gender text);
    CREATE TABLE guest_players(id uuid PRIMARY KEY,gender text,linked_user_id uuid,created_by uuid,group_id uuid);
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,player_id uuid,guest_player_id uuid,
      active boolean DEFAULT true,status rr_participant_status DEFAULT 'active',schedule_game_credit integer DEFAULT 0,schedule_first_eligible_round integer DEFAULT 1,
      updated_by uuid,updated_at timestamptz,replacement_participant_id uuid,replaced_participant_id uuid,effective_round integer,registration_status text DEFAULT 'confirmed',withdrawn_at timestamptz,withdrawal_reason text);
    CREATE TABLE round_robin_schedule(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,round_no integer,court_no integer,is_bye boolean,
      a1_player_id uuid,a1_guest_id uuid,a2_player_id uuid,a2_guest_id uuid,b1_player_id uuid,b1_guest_id uuid,b2_player_id uuid,b2_guest_id uuid,
      locked_at timestamptz,match_id uuid,team1_score integer,team2_score integer,abandoned boolean DEFAULT false,voided_at timestamptz,superseded_by_schedule_id uuid,abandoned_at timestamptz,abandoned_reason text);
    CREATE TABLE round_robin_audit(event_id uuid,editor_id uuid,change_type text,changes jsonb,reason text);
    CREATE TABLE rr_schedule_mutation_requests(request_id uuid PRIMARY KEY,event_id uuid,actor_id uuid,mutation_kind text,input_hash text,status text,response jsonb,completed_at timestamptz);

  `);
  const original=readFileSync("supabase/migrations/20260912100000_round_robin_atomic_schedule_rebuild.sql","utf8");
  for (const name of ["rr_sync_participant_lifecycle","rr_apply_schedule_rebuild"]) {
    const start=original.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
    await db.exec(original.slice(start,original.indexOf("$$;",start)+3));
  }
  await db.exec(`CREATE TRIGGER lifecycle BEFORE INSERT OR UPDATE OF status,active ON round_robin_players FOR EACH ROW EXECUTE FUNCTION rr_sync_participant_lifecycle()`);
  await db.exec(readFileSync("supabase/migrations/20261001180000_round_robin_equal_games.sql","utf8"));
  await db.exec(readFileSync("supabase/migrations/20261003123000_round_robin_roster_adjustments.sql","utf8"));
  return db;
}
