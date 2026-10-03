import { createRoundRobinDatabase } from "./fixtures/database";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { planScheduleAdjustment } from "../../src/lib/roundRobin/scheduleAdjustment";
import { seatsOf, type CoreMatch } from "../../src/lib/roundRobin/scheduleCore";
import { projectRosterAdjustment, planWithRosterFallback, type RosterAdjustment, type RosterMatch } from "../../supabase/functions/_shared/roundRobin/rosterAdjustment";
const uuid = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const event=uuid(1), owner=uuid(2);
const seats=Array.from({length:22},(_,i)=>`${i%2 ? 'g' : 'p'}:${uuid(i+100)}`);
let db:PGlite;
beforeAll(async()=>{db=await createRoundRobinDatabase()},30_000);
afterAll(async()=>{await db?.close()});
const slots=["a1","a2","b1","b2"] as const;
function rows(matches:CoreMatch[]) { return matches.map(m=>({round_no:m.round_no,court_no:m.court_no,is_bye:m.is_bye,
  ...Object.fromEntries(slots.flatMap(slot=>[[`${slot}_player_id`,m[slot]?.startsWith('p:')?m[slot]!.slice(2):null],
  [`${slot}_guest_id`,m[slot]?.startsWith('g:')?m[slot]!.slice(2):null]]))})); }
async function snapshot() {
  const schedule=(await db.query<Record<string,unknown>>("SELECT * FROM round_robin_schedule ORDER BY round_no,court_no")).rows;
  const matches=schedule.map(r=>({...r,...Object.fromEntries(slots.map(slot=>[slot,r[`${slot}_player_id`]?`p:${r[`${slot}_player_id`]}`:r[`${slot}_guest_id`]?`g:${r[`${slot}_guest_id`]}`:null]))})) as unknown as RosterMatch[];
  const roster=(await db.query<{id:string;active:boolean;player_id:string|null;guest_player_id:string|null;schedule_game_credit:number;schedule_first_eligible_round:number}>("SELECT * FROM round_robin_players")).rows;
  const evt=(await db.query<{schedule_version:number;num_rounds:number;games_per_player:number;equal_games:boolean}>("SELECT * FROM round_robin_events")).rows[0];
  return {schedule,matches,roster,evt};
}
const seatOf=(r:{player_id:string|null;guest_player_id:string|null})=>r.player_id?`p:${r.player_id}`:`g:${r.guest_player_id}`;
let nextRequest=500;
async function prepare(change:RosterAdjustment) {
  const {matches,roster,evt}=await snapshot();
  const active=roster.filter(r=>r.active).map(seatOf);
  const projection=projectRosterAdjustment(active,matches,3,change);
  const plan=planScheduleAdjustment({seed:event,currentMatches:projection.matches,currentSeatIds:active,nextSeatIds:projection.nextSeatIds,
    currentTotalRounds:evt.num_rounds,firstMutableRound:4,numCourts:5,gamesPerPlayer:evt.games_per_player,equalGames:evt.equal_games,
    substitutions:projection.substitution?[projection.substitution]:[],existingGameCredits:new Map(roster.map(r=>[seatOf(r),r.schedule_game_credit]))});
  expect(plan.ok,JSON.stringify(plan.warnings)).toBe(true);
  return [uuid(nextRequest++),event,owner,evt.schedule_version,4,5,plan.capacity.recommendedTotalRounds,plan.capacity.gamesPerPlayerTarget,
    JSON.stringify(rows(plan.generatedMatches)),JSON.stringify({capacity:plan.capacity}),"Roster regression",
    projection.substitution?JSON.stringify(projection.substitution):null,
    JSON.stringify(plan.fairness.perPlayer.map(p=>({seat_id:p.seatId,game_credit:plan.gameCredits.get(p.seatId)??0,first_eligible_round:plan.firstEligibleRounds.get(p.seatId)??1}))),JSON.stringify(change)];
}
const apply=(args:unknown[])=>db.query("SELECT rr_apply_roster_adjustment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",args);
beforeEach(async()=>{
  await db.exec("RESET ROLE; TRUNCATE round_robin_events,round_robin_schedule,round_robin_players,round_robin_audit,rr_schedule_mutation_requests,profiles,guest_players");
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.mfa','true',false)",[owner]);
  await db.query("INSERT INTO round_robin_events(id,organizer_id,num_courts,num_rounds,games_per_player,equal_games) VALUES($1,$2,5,7,6,false)",[event,owner]);
  for(const [i,seat] of seats.entries()) {
    await db.query(`INSERT INTO ${seat.startsWith('p:')?'profiles(id)':'guest_players(id,created_by)'} VALUES(${seat.startsWith('p:')?'$1':'$1,$2'})`,seat.startsWith('p:')?[seat.slice(2)]:[seat.slice(2),owner]);
    await db.query("INSERT INTO round_robin_players(id,event_id,player_id,guest_player_id) VALUES($1,$2,$3,$4)",[uuid(i+200),event,seat.startsWith('p:')?seat.slice(2):null,seat.startsWith('g:')?seat.slice(2):null]);
  }
  const initial=planScheduleAdjustment({seed:event,currentMatches:[],currentSeatIds:seats,nextSeatIds:seats,currentTotalRounds:7,firstMutableRound:1,numCourts:5,gamesPerPlayer:6});
  for(const row of rows(initial.schedule)) await db.query("INSERT INTO round_robin_schedule SELECT * FROM jsonb_populate_record(NULL::round_robin_schedule,$1::jsonb)",[JSON.stringify({id:uuid(nextRequest++),event_id:event,...row})]);
  await db.exec("UPDATE round_robin_events SET status='live',current_round=3; UPDATE round_robin_schedule SET team1_score=11,team2_score=6,match_id=gen_random_uuid() WHERE round_no<3 AND NOT is_bye");
});

it("replaces two Round 3 players with resting players, then removes two departures atomically",async()=>{
  const before=await snapshot();
  const current=before.matches.filter(m=>m.round_no===3);
  const playing=current.filter(m=>!m.is_bye), resting=current.filter(m=>m.is_bye).map(m=>m.a1!);
  expect(resting.length).toBeGreaterThanOrEqual(2);
  const out=[playing[0].a1!,playing[1].a1!];
  for(let i=0;i<2;i++) await apply(await prepare({outgoingSeatId:out[i],incomingSeatId:resting[i],includeCurrent:true}));
  let after=await snapshot();
  expect(after.roster.filter(r=>r.active)).toHaveLength(20);
  for(let i=0;i<2;i++) {
    expect(after.matches.find(m=>m.round_no===3&&m.court_no===playing[i].court_no)?.a1).toBe(resting[i]);
    expect(after.matches.filter(m=>m.round_no>3).flatMap(seatsOf)).not.toContain(out[i]);
  }
  await db.exec("UPDATE round_robin_schedule SET team1_score=11,team2_score=8,match_id=gen_random_uuid() WHERE round_no=3 AND NOT is_bye");
  const scored=(await snapshot()).schedule.filter(m=>Number(m.round_no)<=3);
  await apply(await prepare({outgoingSeatId:resting[1],resolution:'keep_current'}));
  await apply(await prepare({outgoingSeatId:playing[2].a1!,resolution:'keep_current'}));
  after=await snapshot();
  expect(after.roster.filter(r=>r.active)).toHaveLength(18);
  expect(after.schedule.filter(m=>Number(m.round_no)<=3)).toEqual(scored);
  expect(before.schedule.filter(m=>Number(m.round_no)<3)).toEqual(after.schedule.filter(m=>Number(m.round_no)<3));
});
it("keeps one-round substitutions roster-neutral and swaps the resting assignment",async()=>{
  const before=await snapshot(), current=before.matches.filter(m=>m.round_no===3);
  const out=current.find(m=>!m.is_bye)!.a1!, incoming=current.find(m=>m.is_bye)!.a1!;
  const roster=before.roster.find(r=>seatOf(r)===out)!;
  await db.query("SELECT rr_substitute_round($1,$2,0,3,$3,$4,$5,'One round')",[uuid(nextRequest++),event,roster.id,incoming.startsWith('p:')?incoming.slice(2):null,incoming.startsWith('g:')?incoming.slice(2):null]);
  const after=await snapshot();
  expect(after.roster.filter(r=>r.active)).toHaveLength(22);
  expect(after.matches.filter(m=>m.round_no===3).flatMap(seatsOf).filter(s=>s===incoming)).toHaveLength(1);
  expect(after.matches.find(m=>m.round_no===3&&m.is_bye&&m.a1===out)).toBeDefined();
  expect(after.schedule.filter(m=>m.round_no!==3)).toEqual(before.schedule.filter(m=>m.round_no!==3));
});
it("rolls back current substitution and removal if the future plan fails",async()=>{
  const before=await snapshot(), current=before.matches.filter(m=>m.round_no===3);
  const args=await prepare({outgoingSeatId:current.find(m=>!m.is_bye)!.a1!,incomingSeatId:current.find(m=>m.is_bye)!.a1!,includeCurrent:true});
  args[8]='[]';
  await expect(apply(args)).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
  expect((await db.query("SELECT * FROM round_robin_audit")).rows).toHaveLength(0);
});
it("rejects stale versions and unauthorized actors, and safely replays completed requests",async()=>{
  const before=await snapshot();const out=before.matches.find(m=>m.round_no===3&&!m.is_bye)!.a1!;
  const args=await prepare({outgoingSeatId:out,resolution:'keep_current'});
  const unauthorized=[...args];unauthorized[2]=uuid(999);
  await expect(apply(unauthorized)).rejects.toThrow('RR_UNAUTHORIZED');
  await apply(args);const after=await snapshot();await apply(args);expect(await snapshot()).toEqual(after);
  const stale=[...args];stale[0]=uuid(nextRequest++);await expect(apply(stale)).rejects.toThrow('RR_STALE_VERSION');
  const conflict=[...args];conflict[13]=JSON.stringify({outgoingSeatId:out,resolution:'abandon'});
  await expect(apply(conflict)).rejects.toThrow('RR_IDEMPOTENCY_CONFLICT');
});
it("protects scores and rejects double-booking a replacement",async()=>{
  const before=await snapshot(), matches=before.matches.filter(m=>m.round_no===3&&!m.is_bye);
  expect(()=>projectRosterAdjustment(seats,before.matches,3,{outgoingSeatId:matches[0].a1!,incomingSeatId:matches[1].a1!,includeCurrent:true})).toThrow('already playing');
  const args=await prepare({outgoingSeatId:matches[0].a1!,resolution:'abandon'});
  await db.exec("UPDATE round_robin_schedule SET team1_score=11,team2_score=7 WHERE round_no=3 AND NOT is_bye");
  await expect(apply(args)).rejects.toThrow('RR_PROTECTED_ROUND');
  expect((await snapshot()).roster).toEqual(before.roster);
});
it("does not expose actor impersonation or service rebuilds to authenticated clients",async()=>{
  const result=await db.query<{helper:boolean;rebuild:boolean}>(`SELECT has_function_privilege('authenticated','rr_substitute_round_as_actor(uuid,uuid,uuid,integer,integer,uuid,uuid,uuid,text)','EXECUTE') AS helper,
  has_function_privilege('authenticated','rr_apply_roster_adjustment(uuid,uuid,uuid,integer,integer,integer,integer,integer,jsonb,jsonb,text,jsonb,jsonb,jsonb)','EXECUTE') AS rebuild`);
  expect(result.rows[0]).toEqual({helper:false,rebuild:false});
});
it.each(['p','g'])("adds a new %s replacement while preserving prior results and durable allocation",async(kind)=>{
  const before=await snapshot(), out=before.matches.find(m=>m.round_no===3&&!m.is_bye)!.a1!;
  const incoming=`${kind}:${uuid(800)}`;
  if(kind==='p') await db.query("INSERT INTO profiles(id) VALUES($1)",[uuid(800)]);
  else await db.query("INSERT INTO guest_players(id,created_by) VALUES($1,$2)",[uuid(800),owner]);
  const args=await prepare({outgoingSeatId:out,incomingSeatId:incoming,includeCurrent:true});
  await apply(args);
  const after=await snapshot(), replacement=after.roster.find(r=>seatOf(r)===incoming)!;
  expect(replacement.active).toBe(true);
  expect(after.roster.find(r=>seatOf(r)===out)!.active).toBe(false);
  expect(after.roster.filter(r=>r.active)).toHaveLength(22);
  expect(after.schedule.filter(m=>Number(m.round_no)<3)).toEqual(before.schedule.filter(m=>Number(m.round_no)<3));
  await apply(args);expect(await snapshot()).toEqual(after);
});
it("allows leaving after the current game without forcing a score or abandoning it",async()=>{
  const before=await snapshot(), out=before.matches.find(m=>m.round_no===3&&!m.is_bye)!.a1!;
  await apply(await prepare({outgoingSeatId:out,resolution:'keep_current'}));
  const after=await snapshot();
  expect(after.schedule.filter(m=>Number(m.round_no)<=3)).toEqual(before.schedule.filter(m=>Number(m.round_no)<=3));
  expect(after.matches.filter(m=>m.round_no>3).flatMap(seatsOf)).not.toContain(out);
});
it("abandons only the departing player's unscored game and balances the remaining roster",async()=>{
  const before=await snapshot(), match=before.matches.find(m=>m.round_no===3&&!m.is_bye)!;
  await apply(await prepare({outgoingSeatId:match.a1!,resolution:'abandon'}));
  const after=await snapshot();
  expect(after.matches.filter(m=>m.abandoned)).toHaveLength(1);
  expect(after.matches.find(m=>m.round_no===3&&m.court_no===match.court_no)?.abandoned).toBe(true);
  expect(after.schedule.filter(m=>Number(m.round_no)<3)).toEqual(before.schedule.filter(m=>Number(m.round_no)<3));
});
it("requires explicit consent to relax mathematically impossible equal totals after departures",()=>{
  // Twenty remaining players, but one of the four previously played seats left:
  // 20 * target - 3 is never divisible by four.
  const active=seats.slice(0,20);
  const history:CoreMatch[]=[{round_no:1,court_no:1,is_bye:false,a1:active[0],a2:active[1],b1:active[2],b2:seats[21]}];
  const input={seed:event,currentMatches:history,currentSeatIds:seats,nextSeatIds:active,currentTotalRounds:7,
    firstMutableRound:2,numCourts:5,gamesPerPlayer:6,equalGames:true};
  expect(planWithRosterFallback(input).code).toBe('equal_games_unavailable');
  const relaxed=planWithRosterFallback(input,true);
  expect(relaxed.ok).toBe(true);
  expect(relaxed.capacity.equalGames).toBe(false);
  expect(relaxed.preservedMatches).toEqual(history);
  expect(relaxed.warnings.some(w=>w.code==='equal_games_relaxed')).toBe(true);
  const feasible=planWithRosterFallback({...input,currentMatches:[]},true);
  expect(feasible.ok).toBe(true);
  expect(feasible.capacity.equalGames).toBe(true);
});
