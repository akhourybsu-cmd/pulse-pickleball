import { readFileSync, statSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260928174500_rally_haus_november_schedule.sql', 'utf8');
const venue = 'd99d7de3-2431-4ee2-a826-04cc293da1cd';
const group = 'd5b47d17-d217-441a-a62a-bcdd87307d62';
const owner = '00000000-0000-4000-8000-000000000001';
let db: PGlite;
afterEach(async () => { await db?.close(); });
async function setup(present = true) {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE venues(id uuid PRIMARY KEY,timezone text,welcome_message text);
    CREATE TABLE groups(id uuid PRIMARY KEY,venue_id uuid REFERENCES venues(id),created_by uuid,type text);
    CREATE TABLE group_members(group_id uuid REFERENCES groups(id),user_id uuid,role text,status text);
    CREATE FUNCTION is_group_member(p_user uuid,p_group uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM group_members WHERE group_id=p_group AND user_id=p_user AND status='active') $$;
    CREATE TABLE group_events(
      id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),venue_id uuid REFERENCES venues(id),created_by uuid,
      title text,description text,location_type text,start_time timestamptz NOT NULL,end_time timestamptz,
      event_format text CHECK(event_format IN ('open_play','clinic','practice','round_robin','social','other','reservation','program_hold','maintenance')),
      capacity integer,skill_level_min numeric,skill_level_max numeric,rotation_style text,
      waitlist_enabled boolean,waitlist_limit integer,is_recurring boolean,recurring_rule text,series_id uuid,
      rr_courts integer,rr_games_per_player integer,parent_event_id uuid,venue_court_id uuid);
    CREATE TABLE group_event_rsvps(id uuid DEFAULT gen_random_uuid(),event_id uuid REFERENCES group_events(id),user_id uuid,status text,waitlist_position integer,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(event_id,user_id));
    CREATE TABLE user_notifications(user_id uuid,notification_type text,category text,title text,message text,link text,priority text);
    CREATE TABLE group_posts(id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),user_id uuid,type text,title text,content text,pinned boolean);
    CREATE TABLE group_files(id uuid PRIMARY KEY,group_id uuid REFERENCES groups(id),uploader_id uuid,file_url text,file_name text,file_type text,file_size integer);
  `);
  const rsvpSql = readFileSync('supabase/migrations/20260831151430_d852ac49-16fa-460f-b65e-ca0fd2343341.sql', 'utf8');
  for (const name of ['promote_group_event_waitlist','set_group_event_rsvp']) {
    const fn = rsvpSql.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`))![0];
    await db.exec(fn);
  }
  if (present) {
    await db.query("INSERT INTO venues VALUES($1,'America/New_York','Owner welcome')", [venue]);
    await db.query("INSERT INTO groups VALUES($1,$2,$3,'venue_official')", [group,venue,owner]);
    await db.query("INSERT INTO group_members VALUES($1,$2,'owner','active')", [group,owner]);
  }
}

it('creates 108 real sessions across six formats, with four sessions per day and Thanksgiving clear', async () => {
  await setup(); await db.exec(migration);
  const rows = (await db.query('SELECT * FROM group_events ORDER BY start_time')).rows;
  expect(rows).toHaveLength(108);
  expect(new Set(rows.map(r => r.event_format))).toEqual(new Set(['open_play','clinic','practice','round_robin','social','other']));
  expect(rows.every(r => r.group_id === group && r.venue_id === venue && r.created_by === owner && r.location_type === 'venue')).toBe(true);
  expect(rows.every(r => Number(r.capacity)>0 && r.waitlist_enabled && Number(r.waitlist_limit)>0)).toBe(true);
  expect(rows.every(r => r.parent_event_id === null && r.venue_court_id === null)).toBe(true);
  const days = (await db.query("SELECT (start_time AT TIME ZONE 'America/New_York')::date::text AS day,count(*)::int AS total FROM group_events GROUP BY 1 ORDER BY 1")).rows;
  expect(days).toHaveLength(27);
  expect(days.every(d => d.total === 4 && d.day !== '2026-11-26')).toBe(true);
  expect(days[0].day).toBe('2026-11-02'); expect(days.at(-1)!.day).toBe('2026-11-29');
  expect((await db.query('SELECT * FROM group_event_rsvps')).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM group_events WHERE event_format='clinic' AND capacity>8")).rows).toHaveLength(0);
}, 30_000);

it('keeps venue-local times, half-hour changeovers, sensible skill ranges, and exact series counts', async () => {
  await setup(); await db.exec(migration);
  const first = (await db.query('SELECT start_time FROM group_events ORDER BY start_time LIMIT 1')).rows[0].start_time;
  expect(new Date(first as string).toISOString()).toBe('2026-11-02T12:00:00.000Z');
  expect((await db.query(`SELECT * FROM group_events WHERE end_time<=start_time
    OR (start_time AT TIME ZONE 'America/New_York')::time < time '07:00'
    OR (end_time AT TIME ZONE 'America/New_York')::time > time '20:00'
    OR skill_level_min>skill_level_max`)).rows).toHaveLength(0);
  expect((await db.query(`SELECT a.id FROM group_events a JOIN group_events b ON a.id<>b.id
    AND a.start_time<b.end_time+interval '30 minutes' AND a.end_time+interval '30 minutes'>b.start_time`)).rows).toHaveLength(0);
  const series = (await db.query('SELECT series_id,recurring_rule,count(*)::int AS total FROM group_events GROUP BY 1,2')).rows;
  expect(series).toHaveLength(28);
  for (const s of series) expect(s.recurring_rule).toBe('WEEKLY:'+s.total);
  expect(series.filter(s => s.total===3)).toHaveLength(4);
  expect((await db.query("SELECT * FROM group_events WHERE event_format='round_robin' AND (rr_courts<>4 OR rr_games_per_player<>5 OR capacity<>16)")).rows).toHaveLength(0);
}, 30_000);

it('uses the existing RSVP capacity and waitlist promotion, and preserves edits and RSVPs on retry', async () => {
  await setup(); await db.exec(migration);
  const event = (await db.query("SELECT id FROM group_events WHERE event_format='clinic' ORDER BY start_time LIMIT 1")).rows[0].id;
  for (let n=1;n<=9;n++) {
    const user = '00000000-0000-4000-8000-'+String(n+10).padStart(12,'0');
    await db.query("INSERT INTO group_members VALUES($1,$2,'member','active')", [group,user]);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[user]);
    expect((await db.query("SELECT set_group_event_rsvp($1,'going') AS status",[event])).rows[0].status).toBe(n<=8?'going':'waitlist');
  }
  await db.query("UPDATE group_events SET title='Manager-edited clinic' WHERE id=$1",[event]);
  await db.exec(migration);
  expect((await db.query('SELECT * FROM group_events')).rows).toHaveLength(108);
  expect((await db.query('SELECT title FROM group_events WHERE id=$1',[event])).rows[0].title).toBe('Manager-edited clinic');
  expect((await db.query('SELECT * FROM group_event_rsvps WHERE event_id=$1',[event])).rows).toHaveLength(9);
  await db.query("SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',false)");
  await db.query("SELECT set_group_event_rsvp($1,'not_going')",[event]);
  expect((await db.query("SELECT status FROM group_event_rsvps WHERE event_id=$1 AND user_id='00000000-0000-4000-8000-000000000019'",[event])).rows[0].status).toBe('going');
  expect((await db.query('SELECT * FROM group_posts')).rows).toHaveLength(1);
  expect((await db.query('SELECT welcome_message FROM venues')).rows[0].welcome_message).toBe('Owner welcome');
}, 30_000);

it('rejects conflicting live events without changing existing records', async () => {
  await setup();
  await db.query(`INSERT INTO group_events(id,group_id,venue_id,title,start_time,end_time,event_format)
    VALUES('00000000-0000-4000-8000-000000000099',$1,$2,'Existing event','2026-11-02T12:30:00Z','2026-11-02T13:30:00Z','social')`,[group,venue]);
  await expect(db.exec(migration)).rejects.toThrow('conflicts with the November import');
  await db.exec('ROLLBACK');
  expect((await db.query('SELECT title FROM group_events')).rows).toEqual([{title:'Existing event'}]);
  expect((await db.query('SELECT * FROM group_posts')).rows).toHaveLength(0);
}, 30_000);

it('skips environments without the venue and refuses mismatched owner or time zone', async () => {
  await setup(false); await db.exec(migration);
  expect((await db.query('SELECT * FROM group_events')).rows).toHaveLength(0);
  await db.query("INSERT INTO venues VALUES($1,'UTC',NULL)",[venue]);
  await expect(db.exec(migration)).rejects.toThrow('existing venue community owner');
  await db.exec('ROLLBACK');
  await db.query("INSERT INTO groups VALUES($1,$2,$3,'venue_official')",[group,venue,owner]);
  await db.query("INSERT INTO group_members VALUES($1,$2,'owner','active')",[group,owner]);
  await expect(db.exec(migration)).rejects.toThrow('time zone'); await db.exec('ROLLBACK');
}, 30_000);

it('exports every imported session exactly once to the downloadable calendar', async () => {
  await setup(); await db.exec(migration);
  const calendar=readFileSync('public/venues/rally-haus/november-2026.ics','utf8').replace(/\r\n[ \t]/g,'');
  const files=(await db.query('SELECT * FROM group_files')).rows;
  expect(files).toHaveLength(1);
  expect(files[0]).toMatchObject({ group_id:group,file_type:'text/calendar',file_size:statSync('public/venues/rally-haus/november-2026.ics').size });
  const events=calendar.split('BEGIN:VEVENT\r\n').slice(1);
  expect(events).toHaveLength(108);
  const rows=(await db.query('SELECT id,start_time,end_time FROM group_events')).rows;
  const stamp=(value: unknown)=>new Date(value as string).toISOString().replace(/[-:]/g,'').replace('.000','');
  for (const row of rows) {
    const entry=events.find(e=>e.includes('UID:'+row.id+'@pulsepb.com\r\n'));
    expect(entry).toContain('DTSTART:'+stamp(row.start_time)+'\r\n');
    expect(entry).toContain('DTEND:'+stamp(row.end_time)+'\r\n');
  }
}, 30_000);
