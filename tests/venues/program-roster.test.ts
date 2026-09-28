import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const db = new PGlite();
const member = '00000000-0000-4000-8000-000000000001';
const outsider = '00000000-0000-4000-8000-000000000002';
const event = '00000000-0000-4000-8000-000000000003';
const emptyEvent = '00000000-0000-4000-8000-000000000004';
const roster = (id = event) => db.query('SELECT * FROM get_venue_program_roster($1)', [id]);
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE group_events(id uuid, parent_event_id uuid, venue_id uuid, event_format text, member_id uuid);
    CREATE TABLE group_event_rsvps(id int, event_id uuid, user_id int, status text, created_at timestamptz DEFAULT now());
    CREATE TABLE profiles_public(id int,first_name text,last_name text,full_name text,display_name text);
    INSERT INTO group_events VALUES('${event}',null,'${event}','open_play','${member}'),('${emptyEvent}',null,'${event}','clinic','${member}');
    INSERT INTO profiles_public VALUES
      (1,'Alex','Smith','Alex Smith','handle'), (2,null,null,'  Jamie  Van   Buren  ','private-handle'),
      (3,'Zoë','Álvarez','Zoë Álvarez',null), (4,null,null,'Prince',null),
      (5,null,null,null,'do-not-use-handle'), (6,null,null,'email@example.com',null),
      (7,'Mary Ann','Jones','Mary Ann Jones',null), (8,'Alex','Sullivan','Alex Sullivan',null),
      (9,'Waitlisted','Surname',null,null), (10,'Maybe','Surname',null,null), (11,'Cancelled','Surname',null,null);
    INSERT INTO group_event_rsvps(id,event_id,user_id,status)
      SELECT n,'${event}',n,CASE n WHEN 9 THEN 'waitlist' WHEN 10 THEN 'maybe' WHEN 11 THEN 'not_going' ELSE 'going' END FROM generate_series(1,12) n;
    ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY event_member ON group_events FOR SELECT USING(member_id=auth.uid());
    ALTER TABLE group_event_rsvps ENABLE ROW LEVEL SECURITY;
    CREATE POLICY rsvp_member ON group_event_rsvps FOR SELECT USING(EXISTS(SELECT 1 FROM group_events e WHERE e.id=event_id));
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
  `);
  await db.exec(readFileSync('supabase/migrations/20260928200000_venue_program_roster.sql', 'utf8'));
  await db.exec('SET ROLE authenticated');
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member]);
},30000);
afterAll(() => db.close());

it('returns only first names and surname initials for confirmed players, preserving duplicate names', async () => {
  const { rows } = await roster();
  expect(rows).toEqual([{name:'Alex S.'},{name:'Alex S.'},{name:'Jamie B.'},{name:'Mary J.'},{name:'Player'},{name:'Player'},{name:'Player'},{name:'Prince'},{name:'Zoë Á.'}]);
  expect(JSON.stringify(rows)).not.toMatch(/Smith|Sullivan|Buren|Álvarez|Jones|handle|example.com|user_id|Waitlisted|Maybe|Cancelled/);
});
it('allows a genuinely empty roster without manufacturing players', async () => {
  expect((await roster(emptyEvent)).rows).toEqual([]);
});
it('retains event RLS and refuses missing events and internal court holds', async () => {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[outsider]);
  await expect(roster()).rejects.toMatchObject({code:'42501'});
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[member]);
  await expect(roster(outsider)).rejects.toMatchObject({code:'42501'});
  await db.exec(`RESET ROLE; UPDATE group_events SET parent_event_id='${event}' WHERE id='${emptyEvent}'; SET ROLE authenticated;`);
  await expect(roster(emptyEvent)).rejects.toMatchObject({code:'42501'});
});
it('does not permit anonymous access, even if a caller supplies an event ID', async () => {
  await db.query("SELECT set_config('request.jwt.claim.sub','',false)");
  await expect(roster()).rejects.toMatchObject({code:'42501'});
  await db.exec('SET ROLE anon');
  await expect(roster()).rejects.toMatchObject({code:'42501'});
});
