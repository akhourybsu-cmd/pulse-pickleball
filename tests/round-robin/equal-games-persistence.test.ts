import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { planScheduleAdjustment } from "../../src/lib/roundRobin/scheduleAdjustment";
import type { CoreMatch } from "../../src/lib/roundRobin/scheduleCore";

const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = uuid(1), owner = uuid(2);
const seats = Array.from({ length: 18 }, (_, i) => `p:${uuid(i + 100)}`);
let db: PGlite;
const migration = readFileSync("supabase/migrations/20261001180000_round_robin_equal_games.sql", "utf8");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA extensions;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT decode(md5($1),'hex') $$;
    CREATE TYPE app_role AS ENUM ('admin','player');
    CREATE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE round_robin_events(id uuid PRIMARY KEY,organizer_id uuid,status text DEFAULT 'draft',current_round integer DEFAULT 1,
      num_courts integer DEFAULT 4,num_rounds integer DEFAULT 1,games_per_player integer DEFAULT 4,schedule_version integer DEFAULT 0,
      voided boolean DEFAULT false,format text DEFAULT 'open',group_id uuid,rating_eligible boolean DEFAULT false,updated_at timestamptz);
    CREATE TABLE profiles(id uuid PRIMARY KEY,gender text);
    CREATE TABLE guest_players(id uuid PRIMARY KEY,gender text,linked_user_id uuid,created_by uuid,group_id uuid);
    CREATE TABLE round_robin_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,player_id uuid,guest_player_id uuid,
      active boolean DEFAULT true,status text DEFAULT 'active',schedule_game_credit integer DEFAULT 0,schedule_first_eligible_round integer DEFAULT 1,
      updated_by uuid,updated_at timestamptz,replacement_participant_id uuid,replaced_participant_id uuid,effective_round integer);
    CREATE TABLE round_robin_schedule(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid,round_no integer,court_no integer,is_bye boolean,
      a1_player_id uuid,a1_guest_id uuid,a2_player_id uuid,a2_guest_id uuid,b1_player_id uuid,b1_guest_id uuid,b2_player_id uuid,b2_guest_id uuid,
      locked_at timestamptz,match_id uuid,team1_score integer,team2_score integer,abandoned boolean DEFAULT false,voided_at timestamptz,superseded_by_schedule_id uuid);
    CREATE TABLE round_robin_audit(event_id uuid,editor_id uuid,change_type text,changes jsonb,reason text);
    CREATE TABLE rr_schedule_mutation_requests(request_id uuid PRIMARY KEY,event_id uuid,actor_id uuid,mutation_kind text,input_hash text,status text,response jsonb,completed_at timestamptz);
    INSERT INTO round_robin_events(id,organizer_id) VALUES('${event}','${owner}');
  `);
  const original = readFileSync("supabase/migrations/20260912100000_round_robin_atomic_schedule_rebuild.sql", "utf8");
  const start = original.indexOf("CREATE OR REPLACE FUNCTION public.rr_apply_schedule_rebuild");
  await db.exec(original.slice(start, original.indexOf("$$;", start) + 3));
  await db.exec(migration);
  // Older events retain balanced mode; a migration rerun doesn't toggle them.
  expect((await db.query<{ equal_games: boolean }>("SELECT equal_games FROM round_robin_events")).rows[0].equal_games).toBe(false);
  await db.exec(migration);
}, 30_000);
beforeEach(async () => {
  await db.exec("TRUNCATE round_robin_events,round_robin_schedule,round_robin_players,round_robin_audit,rr_schedule_mutation_requests");
  await db.query("INSERT INTO round_robin_events(id,organizer_id) VALUES($1,$2)", [event, owner]);
  for (const seat of seats) await db.query("INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)", [event, seat.slice(2)]);
});
afterAll(async () => { await db?.close(); });

function makePlan(history: CoreMatch[] = []) {
  return planScheduleAdjustment({ seed: "db-equal", currentMatches: history, currentSeatIds: seats, nextSeatIds: seats,
    currentTotalRounds: 0, firstMutableRound: history.length ? 2 : 1,
    numCourts: 4, gamesPerPlayer: 4, equalGames: true });
}
function rows(matches: CoreMatch[]) {
  return matches.map(m => ({ round_no: m.round_no, court_no: m.court_no, is_bye: m.is_bye,
    ...Object.fromEntries((["a1", "a2", "b1", "b2"] as const).flatMap(slot => [
      [`${slot}_player_id`, m[slot]?.startsWith("p:") ? m[slot]!.slice(2) : null],
      [`${slot}_guest_id`, m[slot]?.startsWith("g:") ? m[slot]!.slice(2) : null],
    ])) }));
}
async function apply(plan = makePlan(), request = uuid(50), version = 0, actor = owner, replacement = plan.generatedMatches) {
  return db.query("SELECT rr_apply_schedule_rebuild($1,$2,$3,$4,$5,4,$6,$7,$8,$9,'Equal games test',NULL,$10) AS result", [
    request, event, actor, version, plan.capacity.protectedThroughRound + 1, plan.capacity.recommendedTotalRounds,
    plan.capacity.gamesPerPlayerTarget, JSON.stringify(rows(replacement)), JSON.stringify({ capacity: plan.capacity }),
    JSON.stringify(plan.fairness.perPlayer.map(p => ({ seat_id: p.seatId, game_credit: 0, first_eligible_round: 1 }))),
  ]);
}
it("commits partial rounds, equal totals, configuration, and an audit atomically", async () => {
  const plan = makePlan();
  await apply(plan);
  const stored = (await db.query<{ equal_games: boolean; games_per_player: number; num_rounds: number; schedule_version: number }>("SELECT * FROM round_robin_events")).rows[0];
  expect(stored).toMatchObject({ equal_games: true, games_per_player: 4, num_rounds: 5, schedule_version: 1 });
  expect((await db.query("SELECT * FROM round_robin_schedule WHERE NOT is_bye")).rows).toHaveLength(18);
  expect((await db.query("SELECT * FROM round_robin_audit")).rows).toHaveLength(1);
  await apply(plan); // same request is safely replayed
  expect((await db.query("SELECT * FROM round_robin_audit")).rows).toHaveLength(1);
});
it("rejects unequal totals even when every round is structurally valid", async () => {
  const plan = makePlan();
  const modified = plan.generatedMatches.map(m => ({ ...m }));
  const first = modified.find(m => !m.is_bye)!;
  const bye = modified.find(m => m.round_no === first.round_no && m.is_bye)!;
  [first.a1, bye.a1] = [bye.a1, first.a1];
  await expect(apply(plan, uuid(50), 0, owner, modified)).rejects.toThrow("Equal-game totals must match");
  expect((await db.query("SELECT * FROM round_robin_schedule")).rows).toHaveLength(0);
  expect((await db.query("SELECT * FROM rr_schedule_mutation_requests")).rows).toHaveLength(0);
});
it("counts protected games and rejects stale or unauthorized writes", async () => {
  const plan = makePlan();
  await apply(plan);
  await db.exec(`UPDATE round_robin_events SET status='live'; UPDATE round_robin_schedule SET team1_score=11,team2_score=8 WHERE round_no=1 AND NOT is_bye`);
  const history = plan.schedule.filter(m => m.round_no === 1);
  const rebuilt = makePlan(history);
  await expect(apply(rebuilt, uuid(51), 0)).rejects.toThrow("RR_STALE_VERSION");
  await expect(apply(rebuilt, uuid(51), 1, uuid(99))).rejects.toThrow("RR_UNAUTHORIZED");
  await apply(rebuilt, uuid(51), 1);
  const scores = (await db.query<{ team1_score: number }>("SELECT team1_score FROM round_robin_schedule WHERE round_no=1 AND NOT is_bye")).rows;
  expect(scores.every(row => row.team1_score === 11)).toBe(true);
});
