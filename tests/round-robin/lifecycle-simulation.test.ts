import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createRoundRobinDatabase } from './fixtures/database';
import { installMatchEffects } from './fixtures/match-effects';
import { planScheduleAdjustment } from '../../src/lib/roundRobin/scheduleAdjustment';
import { projectRosterAdjustment, planWithRosterFallback, type RosterAdjustment, type RosterMatch } from '../../supabase/functions/_shared/roundRobin/rosterAdjustment';

const uuid = (n:number) => `40000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=uuid(1), owner=uuid(2), seats=Array.from({length:22},(_,i)=>`p:${uuid(100+i)}`);
let db:PGlite;
const timing: { action:string; ms:number }[]=[];
const migration='supabase/migrations/20261003160000_round_robin_scoring_lifecycle.sql';
async function timed<T>(action:string, fn:()=>Promise<T>) { const t=performance.now(); const value=await fn(); timing.push({action,ms:performance.now()-t}); return value; }
beforeAll(async()=>{
  db=await createRoundRobinDatabase();
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
  await db.exec(readFileSync(migration,'utf8'));
  await db.exec(readFileSync(migration,'utf8')); // replay-safe migration
},30_000);
beforeEach(async()=>{
  await db.exec('TRUNCATE round_robin_events,round_robin_schedule,round_robin_players,round_robin_audit,rr_schedule_mutation_requests,profiles,guest_players,matches,match_participants,match_approvals CASCADE');
  await db.query("SELECT set_config('test.uid',$1,false)",[owner]);
  await db.query("INSERT INTO round_robin_events(id,organizer_id,status,num_courts,num_rounds,games_per_player,rating_eligible) VALUES($1,$2,'live',5,7,6,true)",[event,owner]);
  for (const seat of seats) {
    await db.query('INSERT INTO profiles(id) VALUES($1)',[seat.slice(2)]);
    await db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)',[event,seat.slice(2)]);
  }
  const plan=planScheduleAdjustment({seed:event,currentMatches:[],currentSeatIds:seats,nextSeatIds:seats,currentTotalRounds:7,firstMutableRound:1,numCourts:5,gamesPerPlayer:6,equalGames:true});
  expect(plan.ok).toBe(true);
  await db.query('UPDATE round_robin_events SET num_rounds=$1',[plan.capacity.recommendedTotalRounds]);
  for (const [i,m] of plan.schedule.entries()) await db.query(`INSERT INTO round_robin_schedule(id,event_id,round_no,court_no,is_bye,a1_player_id,a2_player_id,b1_player_id,b2_player_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[uuid(1000+i),event,m.round_no,m.court_no,m.is_bye,...[m.a1,m.a2,m.b1,m.b2].map(s=>s?.slice(2)??null)]);
});
afterAll(async()=>{
  await db?.close();
  if(process.env.RR_LIFECYCLE_REPORT) {
    const measurements=[...new Set(timing.map(t=>t.action))].map(action=>{
      const samples=timing.filter(t=>t.action===action).map(t=>t.ms).sort((a,b)=>a-b);
      return {action,count:samples.length,medianMs:+samples[Math.floor(samples.length/2)].toFixed(2),p95Ms:+samples[Math.ceil(samples.length*.95)-1].toFixed(2),maxMs:+samples.at(-1)!.toFixed(2)};
    });
    mkdirSync('.qa-cache',{recursive:true});
    writeFileSync(process.env.RR_LIFECYCLE_REPORT,JSON.stringify({environment:'Isolated PGlite / real SQL functions and rating triggers; no network latency',measurements},null,2));
    console.info('RR_LIFECYCLE',JSON.stringify(measurements));
  }
});
async function first() { return (await db.query<{id:string;a1_player_id:string}>('SELECT * FROM round_robin_schedule WHERE NOT is_bye ORDER BY round_no,court_no LIMIT 1')).rows[0]; }
const score=(id:string,a=11,b=7)=>timed('save score with history and rating effects',()=>db.query<{id:string}>('SELECT submit_rr_match_score($1,$2,$3) AS id',[id,a,b]));

it('immediately records all four player totals and rating changes on a first score',async()=>{
  const match=await first(); await score(match.id);
  const p=(await db.query<{total_matches:number;current_rating:string}>('SELECT * FROM profiles WHERE id=$1',[match.a1_player_id])).rows[0];
  expect(p.total_matches).toBe(1); expect(Number(p.current_rating)).toBeGreaterThan(3.5);
  expect((await db.query('SELECT * FROM match_participants WHERE rating_after IS NOT NULL')).rows).toHaveLength(4);
});
it.each(['abandoned=true','voided_at=now()','superseded_by_schedule_id=gen_random_uuid()'])('rejects an obsolete match (%s) without creating history',async(state)=>{
  const m=await first();await db.query(`UPDATE round_robin_schedule SET ${state} WHERE id=$1`,[m.id]);
  await expect(score(m.id)).rejects.toThrow();
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
});
it.each(['draft','voided'])('rejects scoring a %s event',async(status)=>{
  await db.query('UPDATE round_robin_events SET status=$1',[status]); await expect(score((await first()).id)).rejects.toThrow();
});
it('replays an identical score without duplicate history, ratings, or audit entries',async()=>{
  const m=await first(); const original=await score(m.id);
  const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
  const replay=await timed('retry unchanged score',()=>score(m.id));
  expect(replay.rows).toEqual(original.rows);
  expect((await db.query('SELECT * FROM profiles ORDER BY id')).rows).toEqual(before);
  expect((await db.query("SELECT * FROM round_robin_audit WHERE change_type='score_submit'")).rows).toHaveLength(1);
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(1);
});
it.each([[null,7],[-1,7],[11,11],[11,10],[100,7]])('rejects invalid scores %s–%s atomically',async(a,b)=>{
  await expect(db.query('SELECT submit_rr_match_score($1,$2,$3)',[(await first()).id,a,b])).rejects.toThrow();
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
});
it('corrects a saved result without duplicating matches and updates statistics',async()=>{
  const m=await first();const saved=await score(m.id); const corrected=await timed('correct saved score',()=>score(m.id,5,11));
  expect(corrected.rows).toEqual(saved.rows);
  const p=(await db.query('SELECT * FROM profiles WHERE id=$1',[m.a1_player_id])).rows[0];
  expect(p).toMatchObject({total_matches:1,wins:0,losses:1,total_points_for:5});
  expect(Number(p.current_rating)).toBeLessThan(3.5);
});

const slots=['a1','a2','b1','b2'] as const;
async function state() {
  const evt=(await db.query<{current_round:number;num_rounds:number;schedule_version:number;games_per_player:number;equal_games:boolean}>('SELECT * FROM round_robin_events')).rows[0];
  const schedule=(await db.query<Record<string,unknown>>('SELECT * FROM round_robin_schedule ORDER BY round_no,court_no')).rows;
  const matches=schedule.map(m=>({...m,...Object.fromEntries(slots.map(s=>[s,m[`${s}_player_id`]?`p:${m[`${s}_player_id`]}`:m[`${s}_guest_id`]?`g:${m[`${s}_guest_id`]}`:null]))})) as unknown as (RosterMatch&{id:string})[];
  const roster=(await db.query<{player_id:string;active:boolean;schedule_game_credit:number}>('SELECT * FROM round_robin_players')).rows;
  return {evt,matches,roster};
}
let request=9000;
async function adjust(change:RosterAdjustment) {
  const {evt,matches,roster}=await state();
  const active=roster.filter(r=>r.active).map(r=>`p:${r.player_id}`);
  const projection=projectRosterAdjustment(active,matches,evt.current_round,change);
  const plan=planWithRosterFallback({seed:event,currentMatches:projection.matches,currentSeatIds:active,nextSeatIds:projection.nextSeatIds,currentTotalRounds:evt.num_rounds,
    firstMutableRound:evt.current_round+1,numCourts:5,gamesPerPlayer:evt.games_per_player,equalGames:evt.equal_games,
    existingGameCredits:new Map(roster.map(r=>[`p:${r.player_id}`,r.schedule_game_credit])), substitutions:projection.substitution?[projection.substitution]:[]},true);
  expect(plan.ok,JSON.stringify(plan.warnings)).toBe(true);
  const generated=plan.generatedMatches.map(m=>({round_no:m.round_no,court_no:m.court_no,is_bye:m.is_bye,...Object.fromEntries(slots.flatMap(s=>[[`${s}_player_id`,m[s]?.startsWith('p:')?m[s]!.slice(2):null],[`${s}_guest_id`,m[s]?.startsWith('g:')?m[s]!.slice(2):null]]))}));
  await timed('replace/remove and rebuild future schedule',()=>db.query('SELECT rr_apply_roster_adjustment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[
    uuid(request++),event,owner,evt.schedule_version,evt.current_round+1,5,plan.capacity.recommendedTotalRounds,plan.capacity.gamesPerPlayerTarget,JSON.stringify(generated),JSON.stringify({capacity:plan.capacity}),'Isolated lifecycle simulation',projection.substitution?JSON.stringify(projection.substitution):null,
    JSON.stringify(plan.fairness.perPlayer.map(p=>({seat_id:p.seatId,game_credit:plan.gameCredits.get(p.seatId)??0,first_eligible_round:plan.firstEligibleRounds.get(p.seatId)??1}))),JSON.stringify(change)]));
}
const complete=async(expectedUnscored=0)=>{
  const {evt}=await state();
  return timed('complete event',()=>db.query<{result:{synced_total:number;backfilled:number;unscored:number}}>('SELECT rr_complete_event($1,$2,$3) AS result',[event,evt.schedule_version,expectedUnscored]));
};
it('plays a complete 22-player event, replaces two players in Round 3, removes two departures, and reconciles every saved result',async()=>{
  let removed:string[]=[];
  for(let guard=0;guard<30;guard++) {
    let {evt,matches}=await state();
    if(evt.current_round===3) {
      const playing=matches.filter(m=>m.round_no===3&&!m.is_bye), resting=matches.filter(m=>m.round_no===3&&m.is_bye);
      expect(resting.length).toBeGreaterThanOrEqual(2);
      const outgoing=[playing[0].a1!,playing[1].a1!];
      for(let i=0;i<2;i++) await adjust({outgoingSeatId:outgoing[i],incomingSeatId:resting[i].a1!,includeCurrent:true,allowBalanced:true});
      removed=[resting[1].a1!,playing[2].a1!];
      ({evt,matches}=await state());
    }
    const current=matches.filter(m=>m.round_no===evt.current_round&&!m.is_bye&&!m.abandoned);
    await expect(db.query('SELECT rr_close_round($1,$2)',[event,evt.current_round])).rejects.toThrow();
    for(const m of current) {
      await score(m.id,11,7);
      // Retried requests preserve the same history ID and do not duplicate wins.
      if(m.court_no===1) await score(m.id,11,7);
    }
    if(evt.current_round===3) for(const seat of removed) await adjust({outgoingSeatId:seat,resolution:'keep_current',allowBalanced:true});
    ({evt}=await state());
    if(evt.current_round===evt.num_rounds) break;
    await timed('advance round',()=>db.query('SELECT rr_close_round($1,$2)',[event,evt.current_round]));
  }
  const before=(await db.query('SELECT * FROM profiles ORDER BY id')).rows;
  const completed=await complete(); expect(completed.rows[0].result.unscored).toBe(0);
  const replay=await complete(); expect(replay.rows).toEqual(completed.rows);
  expect((await db.query('SELECT * FROM profiles ORDER BY id')).rows).toEqual(before);
  expect((await db.query("SELECT * FROM round_robin_audit WHERE change_type='event_complete'")).rows).toHaveLength(1);
  expect((await db.query("SELECT * FROM round_robin_events WHERE status='completed' AND current_round IS NULL")).rows).toHaveLength(1);
  const saved=(await db.query('SELECT * FROM round_robin_schedule WHERE NOT is_bye AND NOT coalesce(abandoned,false)')).rows;
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(saved.length);
  expect((await db.query('SELECT * FROM match_participants')).rows).toHaveLength(saved.length*4);
  const mismatches=await db.query(`SELECT p.id FROM profiles p WHERE p.total_matches<>(SELECT count(*) FROM match_participants WHERE player_id=p.id)
    OR p.wins+p.losses<>p.total_matches`);
  expect(mismatches.rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM round_robin_players WHERE active')).rows).toHaveLength(18);
},30_000);
it('backfills legacy scores and completion atomically, including rollback if the audit fails',async()=>{
  const m=await first();await db.query('UPDATE round_robin_schedule SET team1_score=11,team2_score=7 WHERE id=$1',[m.id]);
  const pending=Number((await db.query<{n:number}>('SELECT count(*)::int AS n FROM round_robin_schedule WHERE NOT is_bye AND team1_score IS NULL')).rows[0].n);
  await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT fail_completion CHECK(change_type<>'event_complete')");
  try { await expect(complete(pending)).rejects.toThrow('fail_completion'); } finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT fail_completion'); }
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM profiles WHERE total_matches>0')).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM round_robin_events WHERE status='live'")).rows).toHaveLength(1);
  const result=await complete(pending);expect(result.rows[0].result).toEqual({synced_total:1,backfilled:1,unscored:pending});
  const unplayed=(await db.query<{id:string}>('SELECT id FROM round_robin_schedule WHERE NOT is_bye AND team1_score IS NULL LIMIT 1')).rows[0];
  await expect(score(unplayed.id)).rejects.toThrow('Only existing results');
  await score(m.id,5,11); // deliberate correction remains supported after completion
});
it('rejects a stale lineup, stale completion, and unconfirmed partial completion',async()=>{
  const m=await first();await db.exec('UPDATE round_robin_events SET schedule_version=1');
  await expect(db.query('SELECT submit_rr_match_score($1,11,7,0)',[m.id])).rejects.toThrow('lineup or round changed');
  await expect(db.query('SELECT rr_complete_event($1,0,0)',[event])).rejects.toThrow('schedule changed');
  await expect(complete()).rejects.toThrow('Scores changed');
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
});
it.each(['guest','unranked'])('records %s matches in player totals without changing ratings',async(kind)=>{
  const m=await first();
  if(kind==='guest') {
    await db.query('INSERT INTO guest_players(id,created_by) VALUES($1,$2)',[uuid(800),owner]);
    await db.query('UPDATE round_robin_schedule SET b2_player_id=NULL,b2_guest_id=$1 WHERE id=$2',[uuid(800),m.id]);
  } else await db.exec('UPDATE round_robin_events SET rating_eligible=false');
  await score(m.id);
  expect((await db.query('SELECT * FROM profiles WHERE total_matches=1')).rows).toHaveLength(kind==='guest'?3:4);
  expect((await db.query('SELECT * FROM profiles WHERE current_rating<>3.5')).rows).toHaveLength(0);
  expect((await db.query('SELECT count_for_rating FROM matches')).rows[0].count_for_rating).toBe(false);
});
it('rejects outsiders, missing MFA, and anonymous execution',async()=>{
  const m=await first();await db.query("SELECT set_config('test.uid',$1,false)",[uuid(999)]);
  await expect(score(m.id)).rejects.toThrow('Not authorized');
  await expect(complete()).rejects.toThrow('not authorized');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.mfa','false',false)",[owner]);
  try { await expect(score(m.id)).rejects.toThrow('verification'); } finally { await db.exec("SELECT set_config('test.mfa','true',false)"); }
  const grants=(await db.query<{score:boolean;complete:boolean}>("SELECT has_function_privilege('anon','submit_rr_match_score(uuid,integer,integer)','EXECUTE') AS score,has_function_privilege('anon','rr_complete_event(uuid,integer,integer)','EXECUTE') AS complete")).rows[0];
  expect(grants).toEqual({score:false,complete:false});
});
it('still rejects identical ordinary match submissions within 30 seconds',async()=>{
  const insert=()=>db.query("INSERT INTO matches(status,team1_score,team2_score,match_date,created_by,source) VALUES('pending',11,7,'2026-10-03',$1,'manual')",[owner]);
  await insert();await expect(insert()).rejects.toThrow('Duplicate match');
});
