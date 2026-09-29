import { readFileSync } from "node:fs";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGlite } from "@electric-sql/pglite";

export async function venueEventDatabase() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE profiles(id uuid PRIMARY KEY,additional_league_slots integer DEFAULT 0);
    CREATE TABLE league_slot_purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,stripe_session_id text UNIQUE,stripe_customer_id text,amount_cents integer,currency text,slots_granted integer,status text,created_at timestamptz DEFAULT now(),fulfilled_at timestamptz);
    CREATE FUNCTION increment_league_slots(uuid,integer) RETURNS integer LANGUAGE plpgsql AS $$ DECLARE total integer; BEGIN UPDATE profiles SET additional_league_slots=additional_league_slots+$2 WHERE id=$1 RETURNING additional_league_slots INTO total; IF total IS NULL THEN RAISE EXCEPTION 'Missing profile'; END IF; RETURN total; END $$;
    CREATE TABLE venues(id uuid PRIMARY KEY,name text,owner_id uuid,is_active bool,verification_approved_at timestamptz,hours_of_operation jsonb);
    CREATE TABLE groups(id uuid PRIMARY KEY,venue_id uuid);
    CREATE TABLE group_members(group_id uuid,user_id uuid,status text);
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,is_active boolean,status text,role text);
    CREATE TABLE venue_courts(id uuid PRIMARY KEY,venue_id uuid,name text,is_active bool,hourly_rate numeric);
    CREATE TABLE group_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,venue_id uuid,venue_court_id uuid,created_by uuid,title text,start_time timestamptz,end_time timestamptz,event_format text,location_type text);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text,source text,enabled bool,expires_at timestamptz,updated_at timestamptz DEFAULT now(),PRIMARY KEY(venue_id,module_key));
    CREATE FUNCTION venue_has_module(uuid,text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM venue_module_access WHERE venue_id=$1 AND module_key=$2 AND enabled AND (expires_at IS NULL OR expires_at>now())) $$;
    GRANT SELECT ON venues,groups,group_members,venue_courts TO authenticated;
    GRANT ALL ON group_events TO authenticated,service_role;
  `);
  const legacyVenueSql = readFileSync(
    "supabase/migrations/20251223010423_da2572a8-8021-44d0-a5e2-f68101a7bbf1.sql",
    "utf8"
  );
  for (const table of ["venue_coaches", "venue_lessons", "venue_bookings"]) {
    const definition = legacyVenueSql.match(
      new RegExp(`CREATE TABLE public\\.${table} \\([\\s\\S]*?\\n\\);`)
    );
    if (!definition) throw new Error(`Missing legacy ${table} definition`);
    await db.exec(definition[0]);
  }
  await db.exec(
    readFileSync(
      "supabase/migrations/20260918100000_payment_foundation.sql",
      "utf8"
    )
  );
  await db.exec(
    "CREATE TRIGGER guard_venue_event_module BEFORE INSERT OR UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_module_write()"
  );
  await db.exec(
    "ALTER TABLE venues ADD COLUMN community_model text DEFAULT 'existing'"
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260919100000_eleveno_free_tier_and_upgrade_reactivation.sql",
      "utf8"
    )
  );
  await db.exec(
    "ALTER TABLE venues ADD COLUMN stripe_account_id text; ALTER TABLE venues ADD COLUMN timezone text; CREATE TABLE private_venue_sandboxes(venue_id uuid PRIMARY KEY REFERENCES venues(id),owner_id uuid,group_id uuid);"
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921100000_venue_stripe_readiness.sql",
      "utf8"
    )
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921110000_private_venue_test_payments.sql",
      "utf8"
    )
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260921120000_refund_failure_recovery.sql",
      "utf8"
    )
  );
  for (const table of [
    "venue_payment_accounts",
    "venue_payment_settings",
    "payment_orders",
    "payment_subscriptions",
  ]) {
    await db.exec(
      `CREATE TRIGGER guard_private_sandbox BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION guard_private_venue_sandbox()`
    );
  }
  await db.exec(`
    ALTER TABLE groups ADD COLUMN visibility text DEFAULT 'public', ADD COLUMN created_by uuid;
    ALTER TABLE group_members ADD COLUMN role text DEFAULT 'member';
    ALTER TABLE venue_courts ADD COLUMN court_number integer;
    ALTER TABLE group_events ADD COLUMN description text, ADD COLUMN custom_location text, ADD COLUMN parent_event_id uuid REFERENCES group_events ON DELETE CASCADE,
      ADD COLUMN capacity integer, ADD COLUMN skill_level_min numeric, ADD COLUMN skill_level_max numeric, ADD COLUMN rotation_style text,
      ADD COLUMN waitlist_enabled boolean DEFAULT false, ADD COLUMN waitlist_limit integer, ADD COLUMN is_recurring boolean, ADD COLUMN recurring_rule text, ADD COLUMN series_id uuid,
      ADD COLUMN rr_courts integer, ADD COLUMN rr_games_per_player integer, ADD COLUMN updated_at timestamptz DEFAULT now(),ADD COLUMN created_at timestamptz DEFAULT now();
    CREATE TABLE group_event_rsvps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid REFERENCES group_events ON DELETE CASCADE,user_id uuid,status text,waitlist_position integer,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(event_id,user_id));
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa_required',true),'')<>'unverified' $$;
    CREATE TABLE group_notification_prefs(group_id uuid,user_id uuid,muted_all boolean,events boolean);
    CREATE TABLE change_notifications(user_id uuid,title text);
    CREATE FUNCTION enqueue_notification(uuid,text,text,text,text,text,uuid,jsonb) RETURNS void LANGUAGE sql AS $$ INSERT INTO change_notifications VALUES($1,$4) $$;
    CREATE VIEW profiles_public AS SELECT id,'Alex'::text first_name,'Surname'::text last_name,'Alex Surname'::text full_name FROM auth.users;
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE user_id=$1 AND group_id=$2 AND status='active') $$;
    CREATE FUNCTION promote_group_event_waitlist(uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    CREATE FUNCTION notify_group_event_new() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;
    GRANT ALL ON group_event_rsvps TO authenticated,service_role;
  `);
  for (const migration of [
    "20260904100000_venue_court_reservations.sql",
    "20260928190000_atomic_venue_program_courts.sql",
    "20260928210000_venue_event_management.sql",
    "20260928211000_venue_event_payments.sql",
    "20260928212000_venue_event_operations.sql",
    "20260928213000_venue_event_draft_mfa.sql",
  ])
    await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
  return db;
}
