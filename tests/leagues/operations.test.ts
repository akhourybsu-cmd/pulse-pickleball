import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(__dirname, '../../supabase/migrations', file), 'utf8');
const readFunction = (file: string, name: string) => {
  const sql = read(file); const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start < 0) throw new Error(`Missing production function ${name}`);
  const delimiter = sql.slice(start).match(/\bAS\s+(\$\w*\$)/)?.[1];
  const end = delimiter ? sql.indexOf(`${delimiter};`, start) : -1;
  if (end < 0) throw new Error(`Missing function terminator for ${name}`);
  return sql.slice(start, end + delimiter!.length + 1);
};
const uid = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const owner=uid(1), assistant=uid(2), player=uid(3), opponent=uid(4), outsider=uid(5), sub=uid(6);
const league=uid(11), other=uid(12), season=uid(21), previous=uid(22), foreignSeason=uid(23), session=uid(31), match=uid(41);
let db: PGlite;
async function asUser(id: string, sql: string, args: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
  try { return await db.query(sql, args); }
  finally { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub', '', false)"); }
}
const score = (id=player, a=11, b=7) => asUser(id, 'SELECT submit_league_match_score($1,$2,$3)', [match,a,b]);
const confirm = (id=opponent, a=11, b=7) => asUser(id, 'SELECT confirm_league_match_score($1,$2,$3)', [match,a,b]);
const join = (id=outsider, code='test26') => asUser(id, 'SELECT join_league_by_code($1)', [code]);
const saved = async () => (await db.query('SELECT * FROM league_matches WHERE id=$1', [match])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TYPE public.app_role AS ENUM ('admin','player');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.groups(id uuid PRIMARY KEY);
    CREATE TABLE public.matches(id uuid PRIMARY KEY);
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
  `);
  await db.exec(read('20260703150000_league_management_foundation.sql'));
  await db.exec(read('20260703160000_league_matches_scores.sql'));
  await db.exec(read('20260703170000_leagues_player_read_policies.sql'));
  await db.exec(read('20260703200000_league_teams_visibility_for_standings.sql'));
  await db.exec(read('20260703210000_league_match_score_flow.sql'));
  const ownership=read('20260706231517_cf9d71f6-dd20-48c2-82d5-805b6c98fe44.sql');
  await db.exec(ownership.slice(0,ownership.indexOf('CREATE OR REPLACE FUNCTION public.log_league_action')));
  const forfeits=read('20260703230000_league_dispute_forfeit_and_lifecycle.sql');
  await db.exec(forfeits.slice(0,forfeits.indexOf('-- ---------- 1.')));
  const subs=read('20260718130000_league_substitutes.sql');
  await db.exec(subs.slice(0,subs.indexOf('-- ---------- 4.')));
  await db.exec(read('20260719120000_ladder_foundation.sql'));
  await db.exec('ALTER TABLE leagues ADD COLUMN invite_code text; ALTER TABLE ladder_settings ADD COLUMN self_report_scoring boolean DEFAULT false, ADD COLUMN auto_advance boolean DEFAULT true;');
  await db.exec(readFunction('20260721124511_60ef9065-76c5-4e5c-92f3-10cbbc04a8fa.sql','ladder_generate_first_batch'));
  await db.exec(readFunction('20260728004926_3b24b2a5-051e-44f2-bb75-35a3aab4b03a.sql','ladder_finalize_batch'));
  const migration=read('20260914100000_league_operational_integrity.sql');
  await db.exec(migration); await db.exec(migration);
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;');
  for (const id of [owner,assistant,player,opponent,outsider,sub]) await db.query('INSERT INTO profiles VALUES ($1)',[id]);
},30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE leagues CASCADE;');
  await db.query("INSERT INTO leagues(id,name,created_by,status,visibility,invite_code) VALUES ($1,'Test League',$3,'active','private','TEST26'),($2,'Other',$3,'active','private','OTHER26')",[league,other,owner]);
  await db.query("INSERT INTO league_seasons(id,league_id,name,status) VALUES ($1,$4,'Current','active'),($2,$4,'Previous','completed'),($3,$5,'Foreign','active')",[season,previous,foreignSeason,league,other]);
  for(const [id,role] of [[assistant,'manager'],[player,'player'],[opponent,'player']])
    await db.query("INSERT INTO league_members(league_id,season_id,user_id,role) VALUES ($1,$2,$3,$4)",[league,season,id,role]);
  await db.query("INSERT INTO league_sessions(id,league_id,season_id,name,status,court_count,scheduled_date) VALUES($1,$2,$3,'Week 1','published',2,CURRENT_DATE-1)",[session,league,season]);
  await db.query("INSERT INTO league_matches(id,league_id,season_id,session_id,court_number,player_a_id,player_c_id) VALUES($1,$2,$3,$4,1,$5,$6)",[match,league,season,session,player,opponent]);
});
afterAll(async () => { await db?.close(); });

describe('organizer and member permissions', () => {
  it('lets the owner and active assistant manage the league',async () => {
    for(const id of [owner,assistant]) expect((await asUser(id,'SELECT is_league_admin($1) AS allowed',[league])).rows[0].allowed).toBe(true);
    expect((await asUser(assistant,"UPDATE leagues SET name='Edited' WHERE id=$1 RETURNING id",[league])).rows).toHaveLength(1);
  });
  it('does not let a member edit settings or promote themselves',async () => {
    expect((await asUser(player,"UPDATE leagues SET name='Bad' WHERE id=$1 RETURNING id",[league])).rows).toHaveLength(0);
    expect((await asUser(player,"UPDATE league_members SET role='manager' WHERE user_id=$1 RETURNING id",[player])).rows).toHaveLength(0);
  });
  it('revokes assistant rights immediately on removal',async () => {
    await db.query("UPDATE league_members SET status='removed' WHERE user_id=$1",[assistant]);
    expect((await asUser(assistant,'SELECT is_league_admin($1) AS allowed',[league])).rows[0].allowed).toBe(false);
  });
  it('blocks an assistant taking ownership',async () => {
    await expect(asUser(assistant,'UPDATE leagues SET created_by=$1 WHERE id=$2',[assistant,league])).rejects.toThrow('Only the owner');
  });
  it('keeps unrelated leagues invisible',async () => {
    expect((await asUser(player,'SELECT id FROM leagues WHERE id=$1',[other])).rows).toHaveLength(0);
  });
  it('keeps draft sessions and their matches private until publication',async () => {
    await db.query("UPDATE league_sessions SET status='draft' WHERE id=$1",[session]);
    expect((await asUser(player,'SELECT id FROM league_sessions')).rows).toHaveLength(0);
    expect((await asUser(player,'SELECT id FROM league_matches')).rows).toHaveLength(0);
    expect((await asUser(assistant,'SELECT id FROM league_matches')).rows).toHaveLength(1);
    await expect(score()).rejects.toThrow('Only active participants');
  });
});

describe('season-safe registration',()=>{
  it('joins once and accepts whitespace/case in codes',async()=>{
    await join(outsider,' test26 '); await join();
    expect((await db.query('SELECT id FROM league_members WHERE user_id=$1',[outsider])).rows).toHaveLength(1);
  });
  it('adds a new season membership without moving history',async()=>{
    await db.query("INSERT INTO league_members(league_id,season_id,user_id,role) VALUES($1,$2,$3,'manager')",[league,previous,outsider]);
    await join();
    const rows=(await db.query('SELECT season_id,role FROM league_members WHERE user_id=$1 ORDER BY season_id',[outsider])).rows;
    expect(rows).toEqual([{season_id:season,role:'player'},{season_id:previous,role:'manager'}]);
  });
  it('does not restore a removed manager through the invite',async()=>{
    await db.query("UPDATE league_members SET status='removed' WHERE user_id=$1",[assistant]);
    await expect(join(assistant)).rejects.toThrow('Ask the organizer');
  });
  it('does not bypass pending approval',async()=>{
    await db.query("UPDATE league_members SET status='pending' WHERE user_id=$1",[player]);
    await expect(join(player)).rejects.toThrow('Ask the organizer');
  });
  it('honors deadlines for new-season joins, including old members',async()=>{
    await db.query('UPDATE league_seasons SET registration_deadline=CURRENT_DATE-1 WHERE id=$1',[season]);
    await db.query('INSERT INTO league_members(league_id,season_id,user_id) VALUES($1,$2,$3)',[league,previous,outsider]);
    await expect(join()).rejects.toThrow('Registration is not open');
    await expect(join(player)).resolves.toBeDefined();
  });
  it('does not enroll players into a seasonless roster',async()=>{
    await db.query("UPDATE league_seasons SET status='draft' WHERE id=$1",[season]);
    await expect(join()).rejects.toThrow('Registration is not open');
    expect((await db.query("SELECT registration_open FROM find_league_by_invite_code('TEST26')")).rows[0].registration_open).toBe(false);
  });
  it('rejects archived leagues',async()=>{
    await db.query("UPDATE leagues SET status='archived' WHERE id=$1",[league]);
    await expect(join()).rejects.toThrow('not accepting invitations');
    expect((await db.query("SELECT * FROM find_league_by_invite_code('TEST26')")).rows).toHaveLength(0);
  });
});

describe('schedule and input integrity',()=>{
  it('rejects cross-league season membership',async()=>{
    await expect(asUser(owner,'INSERT INTO league_members(league_id,season_id,user_id) VALUES($1,$2,$3)',[league,foreignSeason,outsider])).rejects.toThrow('season must belong');
  });
  it('rejects cross-season sessions on a match',async()=>{
    await expect(asUser(owner,'UPDATE league_matches SET season_id=$1 WHERE id=$2',[previous,match])).rejects.toThrow('session must belong');
  });
  it('rejects duplicate players',async()=>{
    await expect(asUser(owner,'UPDATE league_matches SET player_b_id=$1 WHERE id=$2',[player,match])).rejects.toThrow('only once');
  });
  it.each([0,3])('rejects unavailable court %s',async(court)=>{
    await expect(asUser(owner,'UPDATE league_matches SET court_number=$1 WHERE id=$2',[court,match])).rejects.toThrow(/Court number/);
  });
  it('does not silently remove an assigned court',async()=>{
    await db.query('UPDATE league_matches SET court_number=2 WHERE id=$1',[match]);
    await expect(asUser(owner,'UPDATE league_sessions SET court_count=1 WHERE id=$1',[session])).rejects.toThrow('Reassign');
  });
  it('rejects reversed session times',async()=>{
    await expect(asUser(owner,"UPDATE league_sessions SET start_time='18:00',end_time='17:00' WHERE id=$1",[session])).rejects.toThrow('End time');
  });
  it('requires unresolved matches to be dealt with before session/season completion',async()=>{
    await expect(asUser(owner,"UPDATE league_sessions SET status='completed' WHERE id=$1",[session])).rejects.toThrow('open matches');
    await expect(asUser(owner,"UPDATE league_seasons SET status='completed' WHERE id=$1",[season])).rejects.toThrow('open matches');
    await score(owner);
    await expect(asUser(owner,"UPDATE league_seasons SET status='completed' WHERE id=$1",[season])).resolves.toBeDefined();
  });
  it('requires an explicit forfeit winner',async()=>{
    await expect(asUser(owner,"UPDATE league_matches SET status='forfeit' WHERE id=$1",[match])).rejects.toThrow('winning team');
  });
});

describe('score lifecycle',()=>{
  it('submits, confirms exactly once, and locks the result',async()=>{
    await score(); expect((await saved()).status).toBe('score_submitted');
    await confirm(); expect((await saved()).status).toBe('verified');
    await expect(confirm()).resolves.toBeDefined();
    await expect(score()).rejects.toThrow('reopen');
  });
  it('requires two distinct participants',async()=>{
    await score(); await confirm(player); expect((await saved()).status).toBe('score_submitted');
    await expect(confirm(outsider)).rejects.toThrow('Only active participants');
  });
  it('rejects a confirmation of a stale displayed score',async()=>{
    await score(); await score(player,11,9);
    await expect(confirm()).rejects.toThrow('score changed');
    expect((await saved()).status).toBe('score_submitted');
  });
  it.each([[11,11],[-1,7],[11,null]])('rejects invalid scores %s %s',async(a,b)=>{
    await expect(asUser(player,'SELECT submit_league_match_score($1,$2,$3)',[match,a,b])).rejects.toThrow('non-negative');
  });
  it('prevents participants bypassing a dispute by resubmitting',async()=>{
    await score(); await asUser(opponent,"SELECT dispute_league_match($1,'Wrong score')",[match]);
    await expect(score()).rejects.toThrow('organizer');
    await score(assistant); expect((await saved()).status).toBe('verified');
  });
  it('blocks removed players even if their match slot remains',async()=>{
    await db.query("UPDATE league_members SET status='removed' WHERE user_id=$1",[player]);
    await expect(score()).rejects.toThrow('Only active participants');
  });
  it('supports active substitutes without regular membership',async()=>{
    await db.query('INSERT INTO league_substitutes(league_id,season_id,user_id) VALUES($1,$2,$3)',[league,season,sub]);
    await db.query('UPDATE league_matches SET player_a_id=$1 WHERE id=$2',[sub,match]);
    await expect(score(sub)).resolves.toBeDefined();
    expect((await asUser(sub,'SELECT id FROM league_matches')).rows).toHaveLength(1);
  });
  it('uses the match time instead of allowing an early score at session start',async()=>{
    await db.query("UPDATE league_matches SET scheduled_time=now()+interval '1 day' WHERE id=$1",[match]);
    await expect(score()).rejects.toThrow('scheduled start');
    await expect(score(owner)).resolves.toBeDefined();
  });
  it('supports self-report ladders',async()=>{
    await db.query('INSERT INTO ladder_settings(league_id,season_id,self_report_scoring) VALUES($1,$2,true)',[league,season]);
    await score(); expect((await saved()).status).toBe('verified');
  });
});

describe('season completion and ladder lifecycle', () => {
  const order = [owner,assistant,player,opponent];
  const firstPlan = () => ({ order, initial_idempotency_key:`init:${season}`, first_batch:{week:1,batch:1,session_id:session,court_waves:1,idempotency_key:`batch:${season}:1:1`,groups:[{group_index:1,court_number:1,wave:1,player_ids:order,games:[
    {game_number:1,side_a:[owner,assistant],side_b:[player,opponent]},
    {game_number:2,side_a:[owner,player],side_b:[assistant,opponent]},
    {game_number:3,side_a:[owner,opponent],side_b:[assistant,player]},
  ]}]}});
  const startLadder = () => asUser(assistant,'SELECT ladder_generate_first_batch($1,$2) AS result',[season,JSON.stringify(firstPlan())]);
  it('generates a real rotating-partner batch once with the new guards', async () => {
    await db.query('INSERT INTO ladder_settings(league_id,season_id) VALUES($1,$2)',[league,season]);
    await startLadder(); await startLadder();
    expect((await db.query('SELECT id FROM ladder_batches')).rows).toHaveLength(1);
    expect((await db.query('SELECT id FROM league_matches WHERE ladder_batch_group_id IS NOT NULL')).rows).toHaveLength(3);
    expect((await db.query('SELECT status FROM ladder_settings')).rows[0].status).toBe('active');
  });
  it('does not advance unconfirmed results through the direct processing RPC', async () => {
    const batch=((await startLadder()).rows[0].result as {first_batch_id:string}).first_batch_id;
    await db.exec("UPDATE league_matches SET team_a_score=11,team_b_score=7,status='score_submitted' WHERE ladder_batch_group_id IS NOT NULL");
    const plan=JSON.stringify({result_snapshot:{week:1,batch:1,player_ids:order,idempotency_key:`result:${season}:1:1`},movements:[]});
    await expect(asUser(assistant,'SELECT ladder_finalize_batch($1,$2)',[batch,plan])).rejects.toThrow('Confirm or resolve');
    await db.exec("UPDATE league_matches SET status='verified' WHERE ladder_batch_group_id IS NOT NULL");
    await expect(asUser(assistant,'SELECT ladder_finalize_batch($1,$2)',[batch,plan])).resolves.toBeDefined();
    expect((await db.query('SELECT status FROM ladder_batches')).rows[0].status).toBe('finalized');
  });
  it('rolls back the entire start operation for a draft season', async () => {
    await db.query("UPDATE league_seasons SET status='draft' WHERE id=$1",[season]);
    await expect(startLadder()).rejects.toThrow('Activate the league');
    expect((await db.query('SELECT id FROM ladder_snapshots')).rows).toHaveLength(0);
  });
  it('closes the ladder and disables automatic progression with its season', async () => {
    await db.query("INSERT INTO ladder_settings(league_id,season_id,status,auto_advance) VALUES($1,$2,'active',true)", [league,season]);
    await score(owner);
    await asUser(owner,"UPDATE league_seasons SET status='completed' WHERE id=$1",[season]);
    expect((await db.query('SELECT status,auto_advance FROM ladder_settings')).rows[0]).toEqual({status:'complete',auto_advance:false});
    await expect(asUser(owner,"UPDATE ladder_settings SET status='active' WHERE season_id=$1",[season])).rejects.toThrow('Activate the league');
  });
  it('rejects new games in a closed season', async () => {
    await expect(asUser(owner,'INSERT INTO league_matches(league_id,season_id) VALUES($1,$2)',[league,previous])).rejects.toThrow('Reopen the season');
  });
  it('requires reopening before changing verified participants', async () => {
    await score(owner);
    await expect(asUser(owner,'UPDATE league_matches SET player_a_id=$1 WHERE id=$2',[assistant,match])).rejects.toThrow('Reopen the result');
    await expect(asUser(owner,"UPDATE league_matches SET status='scheduled',player_a_id=$1 WHERE id=$2",[assistant,match])).resolves.toBeDefined();
  });
  it('rejects starting a ladder for a draft season', async () => {
    await db.query("UPDATE league_seasons SET status='draft' WHERE id=$1",[season]);
    await expect(db.query("INSERT INTO ladder_settings(league_id,season_id,status) VALUES($1,$2,'active')",[league,season])).rejects.toThrow('Activate the league');
  });
  it('syncs eligible seasons while reporting unfinished ones', async () => {
    await db.query('UPDATE league_seasons SET end_date=CURRENT_DATE-1 WHERE id=$1',[season]);
    await db.query("INSERT INTO league_seasons(league_id,name,status,end_date) VALUES($1,'Finished','active',CURRENT_DATE-1)",[league]);
    const result=await asUser(assistant,'SELECT sync_league_season_statuses($1) AS result',[league]);
    expect(result.rows[0].result).toEqual({activated:0,completed:1,needs_attention:1});
    expect((await db.query('SELECT status FROM league_seasons WHERE id=$1',[season])).rows[0].status).toBe('active');
    await expect(asUser(player,'SELECT sync_league_season_statuses($1)',[league])).rejects.toThrow('admin privileges');
  });
});
