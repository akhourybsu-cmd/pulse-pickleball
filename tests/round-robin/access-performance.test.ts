import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import policies from './fixtures/incident-policies.json';

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const host=id(1), player=id(2), stranger=id(3), staff=id(4), owner=id(5), event=id(10), venue=id(20), guest=id(30);
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TYPE app_role AS ENUM ('admin'); CREATE TYPE round_robin_status AS ENUM ('draft','live','completed','voided');
    CREATE TABLE venues(id uuid PRIMARY KEY,owner_id uuid);
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,is_active boolean);
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY,organizer_id uuid,venue_id uuid,group_id uuid,group_visibility text DEFAULT 'personal',
      status round_robin_status DEFAULT 'draft',is_published boolean DEFAULT false,registration_mode text DEFAULT 'immediate',registration_deadline timestamptz);
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY,event_id uuid,player_id uuid,guest_player_id uuid,active boolean DEFAULT true);
    CREATE TABLE round_robin_schedule(id uuid PRIMARY KEY,event_id uuid);
    CREATE TABLE round_robin_audit(id uuid PRIMARY KEY,event_id uuid,editor_id uuid);
    CREATE TABLE guest_players(id uuid PRIMARY KEY,created_by uuid,group_id uuid);
    CREATE FUNCTION pulse_has_required_mfa() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT current_setting('test.mfa',true)='true' $$;
    CREATE FUNCTION can_access_private_venue(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IS DISTINCT FROM '${id(99)}'::uuid $$;
    CREATE FUNCTION can_access_private_group(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 IS DISTINCT FROM '${id(98)}'::uuid $$;
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION is_group_member(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION is_group_admin(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION is_event_participant(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM round_robin_players WHERE event_id=$1 AND player_id=$2 AND active) $$;
    CREATE FUNCTION can_manage_round_robin(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM round_robin_events WHERE id=$1 AND organizer_id=auth.uid()) $$;
    CREATE FUNCTION is_venue_round_robin(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION can_create_guest_player(uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1=auth.uid() $$;
    CREATE FUNCTION can_manage_guest_player(uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM guest_players WHERE id=$1 AND created_by=auth.uid()) $$;
    CREATE FUNCTION can_view_guest_player(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT can_manage_guest_player($1) $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO anon,authenticated;`);
  for (const table of new Set(policies.map(p=>p.tablename))) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  const quote=(s:string)=>`"${s.replaceAll('"','""')}"`;
  for (const p of policies) await db.exec(`CREATE POLICY ${quote(p.policyname)} ON ${p.tablename} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.slice(1,-1)} ${p.qual ? `USING (${p.qual})` : ''} ${p.with_check ? `WITH CHECK (${p.with_check})` : ''}`);
  const migration=readFileSync('supabase/migrations/20261003014000_round_robin_access_performance.sql','utf8');
  await db.exec(migration); await db.exec(migration);
});
beforeEach(async () => {
  await db.exec(`RESET ROLE; SELECT set_config('test.uid','',false),set_config('test.mfa','true',false);
    TRUNCATE venues,venue_staff,round_robin_events,round_robin_players,round_robin_schedule,round_robin_audit,guest_players;
    INSERT INTO venues VALUES('${venue}','${owner}'); INSERT INTO venue_staff VALUES('${venue}','${staff}',true);
    INSERT INTO round_robin_events(id,organizer_id) VALUES('${event}','${host}');
    INSERT INTO round_robin_players VALUES('${id(40)}','${event}','${player}',NULL,true),('${id(41)}','${event}',NULL,'${guest}',true);
    INSERT INTO round_robin_schedule VALUES('${id(50)}','${event}');
    INSERT INTO guest_players VALUES('${guest}','${stranger}',NULL);`);
});
afterAll(async()=>{await db?.close();});
async function asUser(user: string|null) { await db.query("SELECT set_config('test.uid',$1,false)",[user??'']); await db.exec(`SET ROLE ${user?'authenticated':'anon'}`); }
async function rows(table: string) { return (await db.query(`SELECT * FROM ${table}`)).rows; }

it('keeps the standalone host roster, schedule, and managed guest accessible',async()=>{
  await asUser(host);
  expect(await rows('round_robin_events')).toHaveLength(1);
  expect(await rows('round_robin_players')).toHaveLength(2);
  expect(await rows('round_robin_schedule')).toHaveLength(1);
  expect(await rows('guest_players')).toHaveLength(1);
});
it('keeps participants able to see the complete roster and schedule',async()=>{
  await asUser(player);
  expect(await rows('round_robin_events')).toHaveLength(1);
  expect(await rows('round_robin_players')).toHaveLength(2);
  expect(await rows('round_robin_schedule')).toHaveLength(1);
});
it.each([stranger,null])('does not interpret a missing venue as staff access for %s',async(user)=>{
  await asUser(user); expect(await rows('round_robin_events')).toHaveLength(0);
  expect(await rows('round_robin_players')).toHaveLength(0); expect(await rows('round_robin_schedule')).toHaveLength(0);
});
it.each([staff,owner])('preserves active venue staff and venue owner access',async(user)=>{
  await db.exec(`UPDATE round_robin_events SET venue_id='${venue}'`); await asUser(user);
  expect(await rows('round_robin_events')).toHaveLength(1);
});
it('denies inactive venue staff',async()=>{
  await db.exec(`UPDATE round_robin_events SET venue_id='${venue}'; UPDATE venue_staff SET is_active=false`); await asUser(staff);
  expect(await rows('round_robin_events')).toHaveLength(0);
});
it('preserves anonymous published-event and live-kiosk access',async()=>{
  await db.exec("UPDATE round_robin_events SET is_published=true,registration_mode='open_registration',status='live'"); await asUser(null);
  expect(await rows('round_robin_events')).toHaveLength(1); expect(await rows('round_robin_schedule')).toHaveLength(1);
  expect(await rows('round_robin_players')).toHaveLength(2);
});
it('retains MFA and private venue restrictions',async()=>{
  await db.exec("SELECT set_config('test.mfa','false',false)"); await asUser(host);
  expect(await rows('round_robin_events')).toHaveLength(0); expect(await rows('round_robin_players')).toHaveLength(0); expect(await rows('guest_players')).toHaveLength(0);
  await db.exec(`RESET ROLE; SELECT set_config('test.mfa','true',false); UPDATE round_robin_events SET venue_id='${id(99)}'`); await asUser(host);
  expect(await rows('round_robin_events')).toHaveLength(0);
});
it('does not allow an unrelated authenticated account to create a standalone event as another host',async()=>{
  await asUser(stranger);
  await expect(db.exec(`INSERT INTO round_robin_events(id,organizer_id) VALUES('${id(11)}','${host}')`)).rejects.toThrow(/row-level security/);
});
