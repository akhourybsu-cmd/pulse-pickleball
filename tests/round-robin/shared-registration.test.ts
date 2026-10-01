import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = id(1), owner = id(2), player = id(3), group = id(30);
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TYPE round_robin_status AS ENUM ('draft','live','completed','voided');
    CREATE TYPE rr_participant_status AS ENUM ('active','removed','withdrawn','replaced');
    CREATE TABLE profiles(id uuid PRIMARY KEY,gender text,display_name text,full_name text);
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY,organizer_id uuid,status round_robin_status DEFAULT 'draft',voided boolean DEFAULT false,
      registration_mode text DEFAULT 'open_registration',is_published boolean DEFAULT true,invite_code text,registration_deadline timestamptz,
      venue_id uuid,group_id uuid,group_visibility text DEFAULT 'personal',date date DEFAULT CURRENT_DATE,start_time time,name text DEFAULT 'Friday Lights',
      location text,notes text,format text DEFAULT 'open',num_courts integer DEFAULT 4,num_rounds integer DEFAULT 5,max_players integer DEFAULT 4);
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,player_id uuid,guest_player_id uuid,
      registration_status text DEFAULT 'confirmed',active boolean DEFAULT true,status rr_participant_status DEFAULT 'active',joined_at timestamptz DEFAULT now(),
      UNIQUE(event_id,player_id),CHECK(active=(status='active')));
    CREATE TABLE venue_round_robin_links(event_id uuid,round_robin_id uuid);
    CREATE TABLE group_events(id uuid PRIMARY KEY,group_id uuid,capacity integer,price_cents integer,currency text,
      start_time timestamptz DEFAULT now()+interval '1 day',registration_closes_at timestamptz,canceled_at timestamptz,
      registration_paused boolean DEFAULT false,waitlist_enabled boolean DEFAULT true,waitlist_limit integer);
    CREATE TABLE group_event_rsvps(event_id uuid,user_id uuid,status text);
    CREATE FUNCTION can_access_private_venue(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IS DISTINCT FROM '${id(90)}'::uuid $$;
    CREATE FUNCTION can_access_private_group(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT $1 IS DISTINCT FROM '${id(90)}'::uuid $$;
    CREATE FUNCTION can_manage_round_robin(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce((SELECT organizer_id=$2 FROM round_robin_events WHERE id=$1),false) $$;
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION is_event_participant(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM round_robin_players WHERE event_id=$1 AND player_id=$2 AND active) $$;
    CREATE FUNCTION get_public_community(uuid,text) RETURNS jsonb LANGUAGE sql AS $$ SELECT CASE WHEN $1='${group}' THEN '{}'::jsonb END $$;
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.mfa',true),'true')<>'false' $$;
    CREATE FUNCTION generate_rr_invite_code() RETURNS text LANGUAGE sql AS $$ SELECT 'XYZ-1234' $$;
  `);
  const migration = readFileSync("supabase/migrations/20261001230000_round_robin_shared_registration.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec('CREATE TRIGGER rr_events_invite_code_trigger BEFORE INSERT OR UPDATE OF registration_mode ON round_robin_events FOR EACH ROW EXECUTE FUNCTION rr_events_set_invite_code()');
}, 30_000);
beforeEach(async () => {
  await db.exec("RESET ROLE; SELECT set_config('test.uid','',false); SELECT set_config('test.mfa','true',false); TRUNCATE round_robin_events,round_robin_players,profiles,venue_round_robin_links,group_events,group_event_rsvps;");
  await db.query("INSERT INTO round_robin_events(id,organizer_id) VALUES($1,$2)", [event, owner]);
  await db.query("INSERT INTO profiles(id,display_name,gender) VALUES($1,'Host','male'),($2,'New Player','female')", [owner, player]);
});
afterAll(async () => { await db?.close(); });
async function asUser(user: string | null = player) { await db.query("SELECT set_config('test.uid',$1,false)", [user ?? ""]); await db.exec(`SET ROLE ${user ? "authenticated" : "anon"}`); }
async function preview(code?: string) { return (await db.query<{ entry: Record<string, unknown> | null }>("SELECT get_round_robin_entry($1,$2) entry", [event, code ?? null])).rows[0].entry; }
async function join(code?: string) { return (await db.query<{ result: Record<string, unknown> }>("SELECT join_round_robin_event($1,$2) result", [event, code ?? null])).rows[0].result; }

it("lets a signed-out visitor read only the shared summary, then requires authentication to register", async () => {
  await asUser(null);
  expect(await preview()).toMatchObject({ name: "Friday Lights", can_open: false, confirmed_count: 0 });
  expect(await preview()).not.toHaveProperty("invite_code");
  await expect(join()).rejects.toThrow(/permission denied/);
  await expect(db.query("SELECT * FROM round_robin_players")).rejects.toThrow(/permission denied/);
});
it("actually inserts a first-time registrant when capacity is set and is idempotent", async () => {
  await asUser();
  expect(await join()).toMatchObject({ registration_status: "confirmed" });
  expect(await join()).toMatchObject({ registration_status: "confirmed" });
  expect(await preview()).toMatchObject({ confirmed_count: 1, can_open: true, registration_status: "confirmed" });
  await db.exec("RESET ROLE");
  expect((await db.query("SELECT * FROM round_robin_players")).rows).toHaveLength(1);
});
it("assigns the last seat once and saves later requests to a waitlist excluded from playing", async () => {
  await db.exec("UPDATE round_robin_events SET max_players=1");
  await asUser(owner); await join();
  await asUser();
  expect(await join()).toMatchObject({ registration_status: "waitlisted" });
  expect(await join()).toMatchObject({ registration_status: "waitlisted" });
  expect(await preview()).toMatchObject({ confirmed_count: 1, waitlisted_count: 1, waitlist_position: 1, can_open: false });
  await db.exec("RESET ROLE");
  expect((await db.query("SELECT active,status FROM round_robin_players WHERE player_id=$1", [player])).rows[0]).toEqual({ active: false, status: "removed" });
});
it("requires the correct invite, supports legacy code joins, and preserves private summaries", async () => {
  await db.exec("UPDATE round_robin_events SET registration_mode='invite_only',is_published=false,invite_code='ABC-1234'");
  await asUser(null);
  expect(await preview()).toBeNull(); expect(await preview("wrong")).toBeNull();
  expect(await preview(" abc-1234 ")).toMatchObject({ name: "Friday Lights" });
  await asUser();
  await expect(join()).rejects.toThrow("invitation is unavailable");
  const result = await db.query("SELECT * FROM join_round_robin_by_code(' abc-1234 ')");
  expect(result.rows[0]).toMatchObject({ event_id: event, registration_status: "confirmed" });
  expect(await preview()).toMatchObject({ can_open: true });
});
it.each(["registration_deadline=now()-interval '1 minute'", "status='completed'", "status='voided'", "voided=true", "date=CURRENT_DATE-1", "registration_mode='immediate'"])("blocks closed registration: %s", async change => {
  await db.exec(`UPDATE round_robin_events SET ${change}`);
  await asUser(owner); // Host can preview an immediate event but cannot self-register.
  expect((await preview())?.closed_reason).toBeTruthy();
  await expect(join()).rejects.toThrow();
});
it("reactivates a withdrawn registration without creating a duplicate", async () => {
  await db.query("INSERT INTO round_robin_players(event_id,player_id,active,status,registration_status) VALUES($1,$2,false,'withdrawn','withdrawn')", [event, player]);
  await asUser(); await join();
  expect(await preview()).toMatchObject({ confirmed_count: 1, registration_status: "confirmed" });
});
it("handles unlimited capacity, gender requirements, MFA, and private venue boundaries", async () => {
  await db.exec("UPDATE round_robin_events SET max_players=NULL,format='male'"); await asUser();
  await expect(join()).rejects.toThrow("profile gender");
  await db.exec("RESET ROLE; UPDATE round_robin_events SET format='open'; SELECT set_config('test.mfa','false',false)"); await asUser();
  await expect(join()).rejects.toThrow("verification");
  await db.exec("RESET ROLE; SELECT set_config('test.mfa','true',false)"); await asUser(); await join();
  expect(await preview()).toMatchObject({ max_players: null, registration_status: "confirmed" });
  await db.exec(`RESET ROLE; UPDATE round_robin_events SET venue_id='${id(90)}'`); await asUser();
  expect(await preview()).toBeNull();
  await expect(join()).rejects.toThrow("invitation is unavailable");
});
it("routes venue events into the venue's paid registration instead of bypassing it", async () => {
  await db.exec(`UPDATE round_robin_events SET registration_mode='immediate',is_published=false,group_id='${group}';
    INSERT INTO group_events(id,group_id,price_cents,currency,capacity) VALUES('${id(40)}','${group}',2500,'USD',8);
    INSERT INTO venue_round_robin_links VALUES('${id(40)}','${event}');`);
  await asUser(null);
  expect(await preview()).toMatchObject({ price_cents: 2500, closed_reason: null, venue_registration_path: `/player/community/group/${group}?tab=events&program=${id(40)}` });
  await asUser();
  await expect(join()).rejects.toThrow("through the venue");
  await db.exec("RESET ROLE; UPDATE group_events SET capacity=0,waitlist_enabled=false"); await asUser();
  expect((await preview())?.closed_reason).toContain("waitlist are full");
});
it("does not expose a private host summary before required MFA is completed", async () => {
  await db.exec("UPDATE round_robin_events SET registration_mode='immediate',is_published=false; SELECT set_config('test.mfa','false',false)");
  await asUser(owner);
  expect(await preview()).toBeNull();
});
it("makes quick events joinable by invitation while keeping their bare links private", async () => {
  await db.exec("UPDATE round_robin_events SET registration_mode='immediate',is_published=false");
  await asUser(null);
  expect(await preview()).toBeNull();
  expect(await preview('XYZ-1234')).toMatchObject({ name: 'Friday Lights', closed_reason: null });
  await asUser();
  await expect(join()).rejects.toThrow('invitation is unavailable');
  expect(await join('XYZ-1234')).toMatchObject({ registration_status: 'confirmed' });
});
