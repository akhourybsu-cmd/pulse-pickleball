import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { afterEach, expect, it } from 'vitest';
import { buildDayGrid, type Court, type Reservation } from '@/lib/venues/availability';

const migration = readFileSync('supabase/migrations/20260928190000_atomic_venue_program_courts.sql','utf8');
const backfill = readFileSync('supabase/migrations/20260928191000_rally_haus_schedule_courts.sql','utf8');
const schedule = readFileSync('supabase/migrations/20260928174500_rally_haus_november_schedule.sql','utf8');
const venue='d99d7de3-2431-4ee2-a826-04cc293da1cd', group='d5b47d17-d217-441a-a62a-bcdd87307d62';
const owner='00000000-0000-4000-8000-000000000001';
const courts=[1,2,3,4].map(n=>`00000000-0000-4000-9000-00000000000${n}`);
let db: PGlite;
afterEach(async()=>{ await db?.close(); });
async function setup(importSchedule=false) {
  db=new PGlite({extensions:{btree_gist}});
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE venues(id uuid PRIMARY KEY, owner_id uuid,timezone text,welcome_message text,hours_of_operation jsonb DEFAULT '{"slotMinutes":60,"days":{"1":{"open":"06:00","close":"22:00"}}}');
    CREATE TABLE groups(id uuid PRIMARY KEY,venue_id uuid REFERENCES venues,created_by uuid,type text);
    CREATE TABLE group_members(group_id uuid,user_id uuid,role text,status text);
    CREATE TABLE venue_staff(venue_id uuid,user_id uuid,role text,status text,is_active boolean);
    CREATE TABLE venue_courts(id uuid PRIMARY KEY,venue_id uuid REFERENCES venues,name text,court_number integer,is_active boolean,hourly_rate numeric);
    CREATE TABLE venue_module_access(venue_id uuid,module_key text,enabled boolean);
    CREATE FUNCTION venue_has_module(v uuid,k text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM venue_module_access WHERE venue_id=v AND module_key=k AND enabled) $$;
    CREATE TABLE group_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid REFERENCES groups,venue_id uuid REFERENCES venues,created_by uuid,
      title text,description text,location_type text,custom_location text,start_time timestamptz NOT NULL,end_time timestamptz,
      venue_court_id uuid REFERENCES venue_courts,parent_event_id uuid REFERENCES group_events ON DELETE CASCADE,
      event_format text,capacity integer,skill_level_min numeric,skill_level_max numeric,rotation_style text,
      waitlist_enabled boolean,waitlist_limit integer,is_recurring boolean,recurring_rule text,series_id uuid,
      rr_courts integer,rr_games_per_player integer,payment_order_id uuid);
    CREATE UNIQUE INDEX one_hold ON group_events(parent_event_id,venue_court_id);
    CREATE TABLE group_event_rsvps(event_id uuid REFERENCES group_events ON DELETE CASCADE,user_id uuid,status text);
    CREATE TABLE group_posts(id uuid PRIMARY KEY,group_id uuid,user_id uuid,type text,title text,content text,pinned boolean);
    CREATE TABLE group_files(id uuid PRIMARY KEY,group_id uuid,uploader_id uuid,file_url text,file_name text,file_type text,file_size integer);
    CREATE TABLE payment_orders(id uuid DEFAULT gen_random_uuid(),court_id uuid,livemode boolean,status text,start_time timestamptz,end_time timestamptz,kind text,group_id uuid,venue_id uuid,buyer_id uuid);
    CREATE TABLE venue_payment_settings(venue_id uuid,accepting_payments boolean);
    CREATE TABLE notified_events(id uuid);
    CREATE FUNCTION notify_group_event_new() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO notified_events VALUES(NEW.id); RETURN NEW; END $$;
    INSERT INTO venues(id,owner_id,timezone,welcome_message) VALUES('${venue}','${owner}','America/New_York','Owner welcome');
    INSERT INTO groups VALUES('${group}','${venue}','${owner}','venue_official');
    INSERT INTO group_members VALUES('${group}','${owner}','owner','active');
    INSERT INTO venue_module_access VALUES('${venue}','facility_tools',true),('${venue}','court_booking',true);
  `);
  for (const [i,id] of courts.entries()) await db.query('INSERT INTO venue_courts VALUES($1,$2,$3,$4,true,null)',[id,venue,`Court ${i+1}`,i+1]);
  await db.exec(readFileSync('supabase/migrations/20260904100000_venue_court_reservations.sql','utf8'));
  const payments=readFileSync('supabase/migrations/20260918100000_payment_foundation.sql','utf8');
  await db.exec(payments.match(/CREATE FUNCTION public.guard_court_payment\(\)[\s\S]*?EXECUTE FUNCTION public.guard_court_payment\(\);/)![0]);
  await db.exec(payments.match(/CREATE OR REPLACE FUNCTION public.guard_venue_module_write\(\)[\s\S]*?END \$\$;/)![0]);
  await db.exec('CREATE TRIGGER guard_venue_event_module BEFORE INSERT OR UPDATE ON group_events FOR EACH ROW EXECUTE FUNCTION guard_venue_module_write()');
  if(importSchedule) await db.exec(schedule);
  await db.exec(migration);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[owner]);
}
const event=(start='2026-11-02T14:30:00Z',end='2026-11-02T16:00:00Z')=>({title:'Clinic',event_format:'clinic',start_time:start,end_time:end,capacity:8});
const create=(events=[event()],ids=courts.slice(0,2))=>db.query<{id:string}>('SELECT * FROM create_venue_program($1,$2,$3::jsonb,$4::uuid[])',[group,venue,JSON.stringify(events),ids]);
async function count() {return (await db.query<{n:number}>('SELECT count(*)::int n FROM group_events')).rows[0].n;}

it('atomically allocates only requested courts, leaves remaining inventory bookable and releases blocks on cancellation',async()=>{
  await setup(); const {rows:[parent]}=await create();
  expect((await db.query('SELECT * FROM notified_events')).rows).toEqual([{id:parent.id}]);
  const blocks=(await db.query<Reservation>('SELECT * FROM group_events')).rows;
  const inventory=(await db.query<Court>('SELECT * FROM venue_courts')).rows;
  const grid=buildDayGrid(inventory,blocks,new Date(2026,10,2),{timeZone:'America/New_York',openHour:9.5,closeHour:11,slotMinutes:30,now:new Date('2026-01-01')});
  expect(grid.map(c=>c.slots.every(s=>s.bookable))).toEqual([false,false,true,true]);
  await db.query('INSERT INTO group_event_rsvps VALUES($1,$2,\'going\')',[parent.id,owner]);
  await db.query('DELETE FROM group_events WHERE id=$1',[parent.id]);
  expect(await count()).toBe(0);
  expect((await db.query('SELECT * FROM group_event_rsvps')).rows).toHaveLength(0);
},30000);

it('rolls back all occurrences when a later date conflicts with a booking or an active checkout',async()=>{
  await setup(); const later=event('2026-11-09T14:30:00Z','2026-11-09T16:00:00Z');
  await create([later],[courts[1]]);
  await expect(create([event(),later])).rejects.toMatchObject({code:'23P01'});
  expect(await count()).toBe(2);
  await db.query('DELETE FROM group_events WHERE parent_event_id IS NULL');
  await db.query("INSERT INTO payment_orders(court_id,livemode,status,start_time,end_time) VALUES($1,true,'pending',$2,$3)",[courts[1],later.start_time,later.end_time]);
  await expect(create([event(),later])).rejects.toThrow(/held during checkout/);
  expect(await count()).toBe(0);
  await db.exec("UPDATE payment_orders SET status='expired'");
  expect((await create([event(),later])).rows).toHaveLength(2);
  expect(await count()).toBe(6);
},30000);

it('rejects missing duration, zero/duplicate/inactive/foreign courts and missing facility access without orphan rows',async()=>{
  await setup();
  await expect(create([{...event(),end_time:null} as never])).rejects.toThrow(/duration/);
  await expect(create([event()],[])).rejects.toThrow(/distinct court/);
  await expect(create([event()],[courts[0],courts[0]])).rejects.toThrow(/distinct court/);
  await db.query('UPDATE venue_courts SET is_active=false WHERE id=$1',[courts[0]]);
  await expect(create()).rejects.toThrow(/active courts/);
  await expect(create([event()],[owner])).rejects.toThrow(/active courts/);
  await db.exec("UPDATE venue_courts SET is_active=true; UPDATE venue_module_access SET enabled=false WHERE module_key='facility_tools'");
  await expect(create()).rejects.toThrow(/facility_tools/);
  expect(await count()).toBe(0);
},30000);

it('keeps the RPC under row-level permissions and rejects forged owners',async()=>{
  await setup();
  await db.exec(`GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    ALTER TABLE group_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_events ON group_events TO authenticated USING(created_by=auth.uid())
      WITH CHECK(created_by=auth.uid() AND EXISTS(SELECT 1 FROM groups WHERE id=group_id AND created_by=auth.uid()));
    SET ROLE authenticated;`);
  await create([{...event(),created_by:owner} as never]);
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[courts[3]]);
  await expect(create([event('2026-11-03T14:30:00Z','2026-11-03T16:00:00Z')])).rejects.toThrow(/row-level security/);
  await db.exec('RESET ROLE'); expect(await count()).toBe(3);
},30000);

it('prevents bypasses, synchronizes rescheduling and rolls back conflicting edits',async()=>{
  await setup();
  await expect(db.query("INSERT INTO group_events(group_id,venue_id,created_by,title,event_format,start_time,end_time) VALUES($1,$2,$3,'Unallocated','clinic',$4,$5)",[group,venue,owner,event().start_time,event().end_time])).rejects.toThrow(/dedicated courts/);
  const {rows:[parent]}=await create();
  await expect(db.query('DELETE FROM group_events WHERE parent_event_id=$1',[parent.id])).rejects.toThrow(/dedicated courts/);
  await expect(db.query("UPDATE group_events SET end_time=end_time+interval '30 minutes' WHERE parent_event_id=$1",[parent.id])).rejects.toThrow(/full duration/);
  await db.query("UPDATE group_events SET title='Longer clinic',end_time=end_time+interval '30 minutes' WHERE id=$1",[parent.id]);
  expect((await db.query('SELECT DISTINCT end_time,title FROM group_events')).rows).toHaveLength(1);
  await create([event('2026-11-02T16:30:00Z','2026-11-02T17:30:00Z')],[courts[0]]);
  await expect(db.query("UPDATE group_events SET end_time=end_time+interval '30 minutes' WHERE id=$1",[parent.id])).rejects.toMatchObject({code:'23P01'});
  const end=(await db.query<{end_time:string}>('SELECT end_time FROM group_events WHERE id=$1',[parent.id])).rows[0].end_time;
  expect(new Date(end).toISOString()).toBe('2026-11-02T16:30:00.000Z');
},30000);

it('assigns all 108 live-schedule events to existing courts, preserves RSVPs, and is safe to rerun',async()=>{
  await setup(true);
  const first=(await db.query<{id:string}>('SELECT id FROM group_events ORDER BY start_time LIMIT 1')).rows[0].id;
  await db.query("INSERT INTO group_event_rsvps VALUES($1,$2,'going')",[first,owner]);
  await db.exec(backfill);
  expect((await db.query('SELECT * FROM notified_events')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM venue_courts')).rows).toHaveLength(4);
  const allocations=(await db.query<{event_format:string;n:number}>(`SELECT p.event_format,count(h.id)::int n FROM group_events p
    JOIN group_events h ON h.parent_event_id=p.id GROUP BY p.id`)).rows;
  expect(allocations).toHaveLength(108);
  for(const e of allocations) expect(e.n).toBe(({clinic:2,practice:3,other:1} as Record<string,number>)[e.event_format]??4);
  expect(await count()).toBe(475); // 108 public events + 367 physical court blocks.
  expect((await db.query('SELECT * FROM group_event_rsvps')).rows).toHaveLength(1);
  await db.exec(backfill); expect(await count()).toBe(475);
  const hours=(await db.query<{hours_of_operation:{slotMinutes:number;days:unknown}}>('SELECT hours_of_operation FROM venues')).rows[0].hours_of_operation;
  expect(hours).toEqual({slotMinutes:30,days:{'1':{open:'06:00',close:'22:00'}}});
  const bounds=(await db.query("SELECT min(start_time) first,max(end_time) last FROM group_events WHERE parent_event_id IS NOT NULL")).rows[0];
  expect(new Date(bounds.first as string).toISOString()).toBe('2026-11-02T12:00:00.000Z');
},30000);
