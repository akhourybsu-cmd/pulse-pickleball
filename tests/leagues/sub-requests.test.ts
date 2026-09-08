import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { eligibleSubIds, requestableWeeks, type SubRequest, type SubRequestWeek } from '@/lib/leagues/subRequests';

const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const owner=id(1), assistant=id(2), player=id(3), other=id(4), sub=id(5), stranger=id(6), league=id(10), season=id(20), session=id(30);
let db: PGlite;
async function asUser(user: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec('SET ROLE authenticated');
  try { return await db.query(sql, args); } finally { await db.exec('RESET ROLE'); }
}
async function request(user=player) {
  const result = await asUser(user, 'SELECT request_ladder_sub($1,$2,$3) AS result', [season, session, 'Away this week']);
  return (result.rows[0].result as { request_id: string }).request_id;
}
const resolve = (req: string, outcome='sub', fill: string | null=sub, user=owner) => asUser(user, 'SELECT resolve_ladder_sub_request($1,$2,$3,$4)', [req, outcome, fill, 'See you next week']);
const cancel = (req: string, user=player) => asUser(user, 'SELECT cancel_ladder_sub_request($1)', [req]);
const reopen = (req: string, user=owner) => asUser(user, 'SELECT reopen_ladder_sub_request($1)', [req]);
const row = async (req: string) => (await db.query('SELECT * FROM ladder_sub_requests WHERE id=$1', [req])).rows[0];
const draw = () => db.query('INSERT INTO ladder_batches(league_id,season_id,week_number) VALUES($1,$2,2)', [league,season]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
    CREATE TABLE profiles(id uuid PRIMARY KEY, display_name text, full_name text);
    CREATE TABLE leagues(id uuid PRIMARY KEY, created_by uuid, status text, league_type text);
    CREATE TABLE league_seasons(id uuid PRIMARY KEY, league_id uuid, status text);
    CREATE TABLE league_sessions(id uuid PRIMARY KEY, league_id uuid, season_id uuid, week_number int, status text, scheduled_date date);
    CREATE TABLE league_members(id uuid DEFAULT gen_random_uuid(), league_id uuid, season_id uuid, user_id uuid, role text, status text);
    CREATE TABLE league_substitutes(id uuid DEFAULT gen_random_uuid(), league_id uuid, season_id uuid, user_id uuid, status text);
    CREATE TABLE ladder_sub_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), league_id uuid, season_id uuid, session_id uuid, week_number int, player_id uuid,
      note text, status text DEFAULT 'pending' CHECK(status IN ('pending','sub','sitout','declined','canceled')), assigned_sub_id uuid, resolved_by uuid, resolved_at timestamptz,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(session_id,player_id));
    CREATE TABLE ladder_week_sitouts(id uuid DEFAULT gen_random_uuid(), league_id uuid, season_id uuid, week_number int, player_id uuid, note text, created_by uuid, UNIQUE(season_id,week_number,player_id));
    CREATE TABLE ladder_snapshots(id uuid DEFAULT gen_random_uuid(), season_id uuid, week_number int, batch_number int, player_ids uuid[]);
    CREATE TABLE ladder_batches(id uuid DEFAULT gen_random_uuid(), league_id uuid, season_id uuid, week_number int);
    CREATE TABLE league_audit_log(league_id uuid, season_id uuid, actor_user_id uuid, action text, entity_type text, entity_id uuid, old_value jsonb, new_value jsonb);
    CREATE TABLE notifications(recipient uuid, kind text, title text, body text, link text);
    CREATE FUNCTION is_league_admin(l uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM leagues WHERE id=l AND created_by=u) OR EXISTS(SELECT 1 FROM league_members WHERE league_id=l AND user_id=u AND role='manager' AND status='active') $$;
    CREATE FUNCTION create_notification(uuid,text,text,text,text,text,text,jsonb,uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO notifications VALUES($1,$2,$4,$5,$6) $$;
  `);
  const sql = readFileSync('supabase/migrations/20260916100000_league_sub_request_workflow.sql', 'utf8');
  await db.exec(sql); await db.exec(sql);
  for (const uid of [owner,assistant,player,other,sub,stranger]) await db.query("INSERT INTO profiles VALUES($1,'Test player',NULL)", [uid]);
}, 30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE leagues,league_seasons,league_sessions,league_members,league_substitutes,ladder_sub_requests,ladder_week_sitouts,ladder_batches,ladder_snapshots,notifications,league_audit_log');
  await db.query("INSERT INTO leagues VALUES($1,$2,'active','ladder')", [league,owner]);
  await db.query("INSERT INTO league_seasons VALUES($1,$2,'active')", [season,league]);
  await db.query("INSERT INTO league_sessions VALUES($1,$2,$3,2,'published',CURRENT_DATE+7)", [session,league,season]);
  for (const [uid, role] of [[assistant,'manager'],[player,'player'],[other,'player']]) await db.query("INSERT INTO league_members(league_id,season_id,user_id,role,status) VALUES($1,$2,$3,$4,'active')", [league,season,uid,role]);
  await db.query("INSERT INTO league_substitutes(league_id,season_id,user_id,status) VALUES($1,$2,$3,'active')", [league,season,sub]);
  await db.query('INSERT INTO ladder_snapshots(season_id,week_number,batch_number,player_ids) VALUES($1,1,1,$2)', [season,[player,other]]);
});
afterAll(async () => { await db?.close(); });

describe('substitute workflow database guards', () => {
  it('notifies owner and active assistant with a season-aware Actions link; retries are idempotent', async () => {
    const first=await request(); expect(await request()).toBe(first);
    const notes=(await db.query('SELECT * FROM notifications')).rows;
    expect(notes.map(n => n.recipient).sort()).toEqual([owner,assistant].sort());
    expect(notes.every(n => String(n.link).includes(`/manage?tab=actions&season=${season}`))).toBe(true);
  });
  it('requires active membership and rejects unrelated users', async () => { await expect(request(stranger)).rejects.toThrow('Only active'); });
  it.each(['draft','completed','canceled'])('rejects a %s session', async status => {
    await db.query('UPDATE league_sessions SET status=$1',[status]); await expect(request()).rejects.toThrow('not open');
  });
  it('rejects Week 1, past dates and inactive seasons', async () => {
    await db.exec('UPDATE league_sessions SET week_number=1'); await expect(request()).rejects.toThrow('Week 2');
    await db.exec('UPDATE league_sessions SET week_number=2,scheduled_date=CURRENT_DATE-1'); await expect(request()).rejects.toThrow('not open');
    await db.exec("UPDATE league_sessions SET scheduled_date=CURRENT_DATE+7; UPDATE league_seasons SET status='completed'"); await expect(request()).rejects.toThrow('must be active');
  });
  it('preserves the player note and saves the manager note separately', async () => {
    const req=await request(); await resolve(req,'sub',sub,assistant);
    expect(await row(req)).toMatchObject({ status:'sub',assigned_sub_id:sub,note:'Away this week',resolution_note:'See you next week',resolved_by:assistant });
    expect((await db.query("SELECT link FROM notifications WHERE kind='league_sub_resolved'")).rows[0].link).toContain(`?season=${season}`);
  });
  it('a new submission cannot erase arranged coverage', async () => {
    const req=await request(); await resolve(req); await expect(request()).rejects.toThrow('already arranged');
    expect((await row(req)).assigned_sub_id).toBe(sub);
  });
  it('blocks stale resolution after cancellation and duplicate manager decisions', async () => {
    const req=await request(); await cancel(req); await expect(resolve(req)).rejects.toThrow('already resolved');
    await request(); await resolve(req); await expect(resolve(req,'declined',null)).rejects.toThrow('already resolved');
  });
  it('rejects non-manager and null decisions', async () => {
    const req=await request(); await expect(resolve(req,'sub',sub,player)).rejects.toThrow('manager privileges');
    await expect(asUser(owner,'SELECT resolve_ladder_sub_request($1,NULL,NULL,NULL)',[req])).rejects.toThrow('valid decision');
  });
  it('does not assign self, existing ladder players, inactive or foreign fill-ins', async () => {
    const req=await request(); await expect(resolve(req,'sub',player)).rejects.toThrow('different');
    await expect(resolve(req,'sub',other)).rejects.toThrow('already on');
    await expect(resolve(req,'sub',stranger)).rejects.toThrow('active substitute');
    await db.exec("UPDATE league_substitutes SET status='inactive'"); await expect(resolve(req)).rejects.toThrow('active substitute');
  });
  it('does not double book a substitute for the same week', async () => {
    const one=await request(), two=await request(other); await resolve(one); await expect(resolve(two)).rejects.toThrow('already covering');
    expect((await row(two)).status).toBe('pending');
  });
  it('does not offer a substitute who has reported an absence', async () => {
    const req=await request(); await db.query('INSERT INTO ladder_week_sitouts(league_id,season_id,week_number,player_id) VALUES($1,$2,2,$3)',[league,season,sub]);
    await expect(resolve(req)).rejects.toThrow('absent');
  });
  it('sit-out creates exactly one roster exclusion and the player cannot silently cancel it', async () => {
    const req=await request(); await resolve(req,'sitout',null); await expect(cancel(req)).rejects.toThrow('already handled');
    expect((await db.query('SELECT * FROM ladder_week_sitouts')).rows).toHaveLength(1);
  });
  it('manager can reopen a sit-out then assign coverage, with no stale exclusion', async () => {
    const req=await request(); await resolve(req,'sitout',null); await reopen(req,assistant);
    expect((await row(req)).status).toBe('pending'); expect((await db.query('SELECT * FROM ladder_week_sitouts')).rows).toHaveLength(0);
    await resolve(req); expect((await row(req)).status).toBe('sub');
  });
  it('cannot reopen a canceled request or reopen as another player', async () => {
    const req=await request(); await cancel(req); await expect(reopen(req)).rejects.toThrow('resolved request');
    await request(); await resolve(req); await expect(reopen(req,other)).rejects.toThrow('manager privileges');
  });
  it('allows a player to request again after a declined decision', async () => {
    const req=await request(); await resolve(req,'declined',null); expect(await request()).toBe(req);
    expect(await row(req)).toMatchObject({status:'pending',resolution_note:null});
  });
  it('blocks a draw while requests are pending and freezes arrangements after the draw', async () => {
    const req=await request(); await expect(draw()).rejects.toThrow('Resolve pending');
    await resolve(req); await draw(); await expect(cancel(req,owner)).rejects.toThrow('already drawn');
    await expect(reopen(req)).rejects.toThrow('already drawn'); await expect(request(other)).rejects.toThrow('already drawn');
  });
  it('cancellation is audited, idempotent and restricted to requester/manager', async () => {
    const req=await request(); await expect(cancel(req,other)).rejects.toThrow('own request');
    await cancel(req); await cancel(req);
    expect((await db.query("SELECT * FROM league_audit_log WHERE action='ladder.sub_request_canceled'")).rows).toHaveLength(1);
  });
  it('revokes anonymous access to all request mutations', async () => {
    for (const signature of ['request_ladder_sub(uuid,uuid,text)','resolve_ladder_sub_request(uuid,text,uuid,text)','cancel_ladder_sub_request(uuid)','reopen_ladder_sub_request(uuid)']) {
      expect((await db.query('SELECT has_function_privilege($1,$2,$3) AS allowed',['anon',signature,'EXECUTE'])).rows[0].allowed).toBe(false);
    }
  });
});

describe('request eligibility presentation', () => {
  it('filters both bench and member pools by conflicts, deduplicating candidates', () => {
    const req={id:'r',session_id:'w',player_id:'out',status:'pending'} as SubRequest;
    const others=[req,{id:'r2',session_id:'w',player_id:'other',status:'sub',assigned_sub_id:'booked'}, {id:'r3',session_id:'w',player_id:'absent',status:'pending'}] as SubRequest[];
    expect(eligibleSubIds(['out','on-ladder','booked','absent','sitout','free','free'],['out','on-ladder'],others,req,['sitout'])).toEqual(['free']);
  });
  it('only lists published future/current weeks from week 2 before generation', () => {
    const base={id:'w',week_number:2,scheduled_date:'2026-09-08',status:'published'} as SubRequestWeek;
    expect(requestableWeeks([base,{...base,id:'first',week_number:1},{...base,id:'draft',status:'draft'},{...base,id:'old',scheduled_date:'2026-09-07'},{...base,id:'generated',week_number:3}],new Set([3]),'2026-09-08')).toEqual([base]);
  });
});
