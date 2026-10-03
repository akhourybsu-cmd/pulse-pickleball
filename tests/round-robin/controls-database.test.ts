import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { createScoringDatabase } from './fixtures/scoring-database';
import { installControlSchema } from './fixtures/control-schema';
import { computeStandings } from '../../src/lib/roundRobin/standings';
import { roundProgress } from '../../src/lib/roundRobin/roundProgress';

const id = (n: number) => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const event = id(1), owner = id(2), manager = id(3), outsider = id(4);
const players = Array.from({ length: 8 }, (_, i) => id(100 + i));
const migration = readFileSync('supabase/migrations/20261003200000_round_robin_control_safety.sql', 'utf8');
let db: PGlite;
let request = 500;
async function rpc<T = unknown>(fn: string, args: unknown[], actor = owner): Promise<T> {
  await db.query("SELECT set_config('test.uid',$1,false)", [actor]);
  await db.exec('SET ROLE authenticated');
  try { return (await db.query<{ result: T }>(`SELECT ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS result`, args)).rows[0].result; }
  finally { await db.exec('RESET ROLE'); }
}
const version = async () => Number((await db.query<{ v: number }>('SELECT schedule_version AS v FROM round_robin_events WHERE id=$1', [event])).rows[0].v);
const score = async (scheduleId = id(1001), a = 11, b = 7) => rpc<string>('submit_rr_match_score', [scheduleId, a, b, await version()]);
const settings = async (updates: Record<string, unknown>) => rpc('rr_update_event_settings', [event, await version(), JSON.stringify(updates)]);
const edit = async (action: string, match = id(1001), other: string | null = null, court: number | null = null) => rpc('rr_edit_schedule', [id(request++), event, await version(), action, match, other, court, null]);
async function removalArgs(action = 'void', scheduleId = id(1001)) {
  const row = (await db.query<{ match_id: string; team1_score: number; team2_score: number }>('SELECT * FROM round_robin_schedule WHERE id=$1', [scheduleId])).rows[0];
  return [scheduleId, await version(), action, row.match_id, row.team1_score, row.team2_score];
}
async function snapshot() {
  return Promise.all(['round_robin_events', 'round_robin_schedule', 'round_robin_audit', 'matches', 'match_participants', 'profiles', 'rr_schedule_mutation_requests']
    .map(async table => (await db.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows));
}
beforeAll(async () => {
  db = await createScoringDatabase();
  await installControlSchema(db);
  await db.exec(`
    CREATE OR REPLACE FUNCTION has_role(uuid,app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin',true),'false')='true' $$;
    CREATE OR REPLACE FUNCTION can_manage_round_robin(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS(SELECT 1 FROM round_robin_events WHERE id=$1 AND (organizer_id=$2 OR $2='${manager}')) OR public.has_role($2,'admin') $$;
  `);
  await db.exec(migration);
  await db.exec(migration); // Guards and patches are safe to replay.
}, 30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE round_robin_events,round_robin_schedule,round_robin_players,round_robin_audit,rr_schedule_mutation_requests,profiles,guest_players,matches,match_participants,match_approvals CASCADE');
  await db.query("SELECT set_config('test.uid',$1,false),set_config('test.mfa','true',false),set_config('test.admin','false',false)", [owner]);
  await db.query("INSERT INTO round_robin_events(id,organizer_id,status,num_courts,num_rounds,rating_eligible) VALUES($1,$2,'draft',2,3,true)", [event, owner]);
  for (const [i, pid] of players.entries()) {
    await db.query('INSERT INTO profiles(id,gender) VALUES($1,$2)', [pid, i % 2 ? 'female' : 'male']);
    await db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)', [event, pid]);
  }
  for (let round = 1; round <= 3; round++) for (let court = 1; court <= 2; court++) {
    await db.query(`INSERT INTO round_robin_schedule(id,event_id,round_no,court_no,is_bye,a1_player_id,a2_player_id,b1_player_id,b2_player_id)
      VALUES($1,$2,$3,$4,false,$5,$6,$7,$8)`, [id(1000 + (round - 1) * 2 + court), event, round, court, ...players.slice((court - 1) * 4, court * 4)]);
  }
});
afterAll(async () => { await db?.close(); });
const start = async () => rpc('rr_start_event', [event, await version()]);

it('starts once, supports venue managers, and never resets a live round on a delayed retry', async () => {
  expect(await rpc('rr_start_event', [event, 0], manager)).toEqual({ current_round: 1, already_started: false });
  await score(id(1001)); await score(id(1002));
  await rpc('rr_close_round', [event, 1]);
  expect(await rpc('rr_start_event', [event, 0])).toEqual({ current_round: 2, already_started: true });
  expect((await db.query("SELECT * FROM round_robin_audit WHERE change_type='event_start'")).rows).toHaveLength(1);
});
it.each(['no-schedule', 'missing-round', 'removed-player', 'unfilled-seat', 'duplicate-seat', 'new-player', 'stale'])('rejects unsafe start: %s', async kind => {
  if (kind === 'no-schedule') await db.exec('DELETE FROM round_robin_schedule');
  if (kind === 'missing-round') await db.exec('DELETE FROM round_robin_schedule WHERE round_no=2');
  if (kind === 'removed-player') await db.query("UPDATE round_robin_players SET active=false WHERE player_id=$1", [players[0]]);
  if (kind === 'unfilled-seat') await db.query('UPDATE round_robin_schedule SET a1_player_id=NULL WHERE id=$1', [id(1001)]);
  if (kind === 'duplicate-seat') await db.query('UPDATE round_robin_schedule SET a1_player_id=a2_player_id WHERE id=$1', [id(1001)]);
  if (kind === 'new-player') { await db.query('INSERT INTO profiles(id) VALUES($1)', [id(199)]); await db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)', [event, id(199)]); }
  if (kind === 'stale') await db.exec('UPDATE round_robin_events SET schedule_version=1');
  const before = await snapshot();
  await expect(rpc('rr_start_event', [event, 0])).rejects.toThrow();
  expect(await snapshot()).toEqual(before);
});
it('rotates partners, swaps opponent teams, swaps occupied courts, and preserves all seats', async () => {
  await edit('rotate_partners');
  expect((await db.query('SELECT a2_player_id,b1_player_id FROM round_robin_schedule WHERE id=$1', [id(1001)])).rows[0]).toEqual({ a2_player_id: players[2], b1_player_id: players[1] });
  await edit('swap_opponents', id(1001), id(1002));
  await edit('move_court', id(1001), null, 2);
  const rows = (await db.query<Record<string, string>>('SELECT * FROM round_robin_schedule WHERE round_no=1 ORDER BY court_no')).rows;
  expect(rows[0].id).toBe(id(1002)); expect(rows[1].id).toBe(id(1001));
  expect(rows.flatMap(row => ['a1', 'a2', 'b1', 'b2'].map(seat => row[`${seat}_player_id`])).sort()).toEqual([...players].sort());
  await start();
});
it('keeps mixed teams valid and rejects stale edits, live-round edits and swaps across rounds atomically', async () => {
  await db.exec("UPDATE round_robin_events SET format='mixed'");
  const requestId = id(request++);
  const args = [requestId, event, 0, 'rotate_partners', id(1001), null, null, null];
  const first = await rpc('rr_edit_schedule', args);
  expect(await rpc('rr_edit_schedule', args)).toEqual(first);
  expect((await db.query('SELECT a2_player_id,b2_player_id FROM round_robin_schedule WHERE id=$1', [id(1001)])).rows[0]).toEqual({ a2_player_id: players[3], b2_player_id: players[1] });
  let before = await snapshot();
  await expect(rpc('rr_edit_schedule', [id(request++), event, 0, 'rotate_partners', id(1001), null, null, null])).rejects.toThrow('STALE');
  await expect(edit('swap_opponents', id(1001), id(1003))).rejects.toThrow('within one round');
  expect(await snapshot()).toEqual(before);
  await start(); before = await snapshot();
  await expect(edit('rotate_partners')).rejects.toThrow('PROTECTED');
  expect(await snapshot()).toEqual(before);
  await edit('rotate_partners', id(1003));
});
it.each(['ranked', 'unranked', 'claimed-guest'])('voids a %s result atomically and reconciles standings, history and player totals', async kind => {
  if (kind === 'unranked') await settings({ rating_eligible: false });
  if (kind === 'claimed-guest') {
    await db.query('INSERT INTO guest_players(id,linked_user_id,created_by) VALUES($1,$2,$3)', [id(900), players[0], owner]);
    await db.query('UPDATE round_robin_players SET player_id=NULL,guest_player_id=$1 WHERE player_id=$2', [id(900), players[0]]);
    await db.query('UPDATE round_robin_schedule SET a1_player_id=NULL,a1_guest_id=$1 WHERE a1_player_id=$2', [id(900), players[0]]);
  }
  await start(); const result = await score();
  expect((await db.query<{ n: number }>('SELECT total_matches AS n FROM profiles WHERE id=$1', [players[0]])).rows[0].n).toBe(1);
  const args = await removalArgs();
  expect(await rpc('rr_remove_match_result', args, manager)).toBe(true);
  const after = await snapshot();
  expect(await rpc('rr_remove_match_result', args)).toBe(true); expect(await snapshot()).toEqual(after);
  expect((await db.query('SELECT voided FROM matches WHERE id=$1', [result])).rows[0].voided).toBe(true);
  expect((await db.query('SELECT total_matches,wins,losses,current_rating FROM profiles WHERE id=$1', [players[0]])).rows[0]).toMatchObject({ total_matches: 0, wins: 0, losses: 0, current_rating: '3.5' });
  const rows = (await db.query('SELECT * FROM round_robin_schedule WHERE round_no=1')).rows;
  expect(roundProgress(rows)).toMatchObject({ resolved: 1, pending: 1 });
  expect(computeStandings(rows, players.map(key => ({ key, name: key }))).every(row => row.gamesPlayed === 0)).toBe(true);
  await expect(score()).rejects.toThrow('no longer playable');
  await score(id(1002)); expect(await rpc('rr_close_round', [event, 1])).toBe(2);
});
it('requires admin for permanent deletion and keeps the court resolved after deleting history', async () => {
  await start(); await score(); const args = await removalArgs('delete');
  const before = await snapshot(); await expect(rpc('rr_remove_match_result', args)).rejects.toThrow('administrator');
  expect(await snapshot()).toEqual(before);
  await db.exec("SELECT set_config('test.admin','true',false)");
  expect(await rpc('rr_remove_match_result', args)).toBe(true);
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM match_participants')).rows).toHaveLength(0);
  expect((await db.query('SELECT abandoned,match_id,team1_score FROM round_robin_schedule WHERE id=$1', [id(1001)])).rows[0]).toEqual({ abandoned: true, match_id: null, team1_score: null });
  expect((await db.query('SELECT * FROM profiles WHERE total_matches>0')).rows).toHaveLength(0);
  expect(await rpc('rr_remove_match_result', args)).toBe(true);
});
it('rejects removal of a newer score and rolls back every effect if auditing fails', async () => {
  await start(); await score(); const stale = await removalArgs(); await score(id(1001), 11, 5);
  let before = await snapshot(); await expect(rpc('rr_remove_match_result', stale)).rejects.toThrow('match changed');
  expect(await snapshot()).toEqual(before);
  const args = await removalArgs();
  await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT fail_void CHECK(change_type<>'match_void')");
  before = await snapshot();
  try { await expect(rpc('rr_remove_match_result', args)).rejects.toThrow('fail_void'); expect(await snapshot()).toEqual(before); }
  finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT fail_void'); }
});
it('can complete an event where all results were voided without recreating them', async () => {
  await start();
  for (let n = 1001; n <= 1006; n++) { await score(id(n)); await rpc('rr_remove_match_result', await removalArgs('void', id(n))); }
  expect(await rpc('rr_complete_event', [event, await version(), 0])).toEqual({ synced_total: 0, backfilled: 0, unscored: 0 });
  expect((await db.query('SELECT * FROM matches WHERE NOT voided')).rows).toHaveLength(0);
  await expect(start()).rejects.toThrow('draft');
});
it('saves metadata and cleared deadlines together, rejects stale changes, and rolls back on audit failure', async () => {
  await settings({ registration_deadline: '2026-10-04T13:00:00Z' });
  await settings({ name: '  Friday mixer  ', registration_deadline: null });
  expect((await db.query('SELECT name,registration_deadline FROM round_robin_events')).rows[0]).toEqual({ name: 'Friday mixer', registration_deadline: null });
  await expect(rpc('rr_update_event_settings', [event, 0, '{"name":"Old screen"}'])).rejects.toThrow('event changed');
  await expect(settings({ name: '   ' })).rejects.toThrow('name');
  await expect(settings({ max_players: 4 })).rejects.toThrow('confirmed');
  await expect(settings({ organizer_id: outsider })).rejects.toThrow('Unsupported');
  await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT fail_settings CHECK(change_type<>'event_settings') NOT VALID");
  const before = await snapshot();
  try { await expect(settings({ name: 'Do not persist' })).rejects.toThrow('fail_settings'); expect(await snapshot()).toEqual(before); }
  finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT fail_settings'); }
});
it('uses new rating rules for future results while corrections keep their original policy', async () => {
  await start(); const ranked = await score();
  await settings({ rating_eligible: false, rating_type: 'casual' });
  await score(id(1001), 11, 5);
  const unranked = await score(id(1002));
  expect((await db.query('SELECT count_for_rating,match_type FROM matches WHERE id=$1', [ranked])).rows[0]).toEqual({ count_for_rating: true, match_type: 'league' });
  expect((await db.query('SELECT count_for_rating,match_type FROM matches WHERE id=$1', [unranked])).rows[0]).toEqual({ count_for_rating: false, match_type: 'casual' });
  await settings({ rating_eligible: true }); await score(id(1002), 11, 5);
  expect((await db.query('SELECT count_for_rating FROM matches WHERE id=$1', [unranked])).rows[0].count_for_rating).toBe(false);
});
it('rejects outsiders, incomplete MFA and anonymous execution for every new control', async () => {
  for (const [fn, args] of [['rr_start_event', [event, 0]], ['rr_update_event_settings', [event, 0, '{}']], ['rr_remove_match_result', [id(1001), 0, 'void', null, null, null]]] as const) {
    await expect(rpc(fn, [...args], outsider)).rejects.toThrow('not authorized');
    await db.exec("SELECT set_config('test.mfa','false',false)");
    try { await expect(rpc(fn, [...args])).rejects.toThrow('verification'); }
    finally { await db.exec("SELECT set_config('test.mfa','true',false)"); }
    expect((await db.query<{ allowed: boolean }>("SELECT has_function_privilege('anon',p.oid,'EXECUTE') AS allowed FROM pg_proc p WHERE proname=$1", [fn])).rows.every(row => !row.allowed)).toBe(true);
  }
});

it('voids an entire event once and reconciles every saved result without deleting history', async () => {
  await start(); await score(); await score(id(1002));
  await rpc('void_round_robin_event', [event, 'Host cancellation'], manager);
  const after = await snapshot();
  await rpc('void_round_robin_event', [event, 'Retried cancellation']);
  expect(await snapshot()).toEqual(after);
  expect((await db.query('SELECT * FROM matches WHERE NOT voided')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(2);
  expect((await db.query('SELECT * FROM profiles WHERE total_matches>0 OR current_rating<>3.5')).rows).toHaveLength(0);
  await expect(score()).rejects.toThrow('active or completed');
  await expect(settings({ name: 'Change' })).rejects.toThrow('read-only');
});
it('deletes an unplayed event but protects saved results until an admin performs deletion', async () => {
  await start(); await score();
  const before = await snapshot();
  await expect(rpc('delete_round_robin_event', [event])).rejects.toThrow('saved results');
  expect(await snapshot()).toEqual(before);
  await db.exec("SELECT set_config('test.admin','true',false)");
  await rpc('delete_round_robin_event', [event]);
  expect((await db.query('SELECT * FROM round_robin_events')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM matches')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM match_participants')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM profiles WHERE total_matches>0 OR current_rating<>3.5')).rows).toHaveLength(0);
});
it('rolls back event cancellation if the final audit cannot be saved', async () => {
  await start(); await score();
  await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT fail_event_void CHECK(change_type<>'event_void')");
  const before = await snapshot();
  try { await expect(rpc('void_round_robin_event', [event, null])).rejects.toThrow('fail_event_void'); expect(await snapshot()).toEqual(before); }
  finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT fail_event_void'); }
});
it('removes a draft schedule and its mutation ledger together', async () => {
  await edit('rotate_partners');
  await rpc('delete_round_robin_event', [event]);
  for (const table of ['round_robin_events', 'round_robin_schedule', 'round_robin_players', 'rr_schedule_mutation_requests', 'round_robin_audit']) {
    expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
  }
});
