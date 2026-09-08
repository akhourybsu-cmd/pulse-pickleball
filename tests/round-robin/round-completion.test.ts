import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';

const owner = '10000000-0000-0000-0000-000000000001';
const outsider = '10000000-0000-0000-0000-000000000002';
const admin = '10000000-0000-0000-0000-000000000003';
const event = '20000000-0000-0000-0000-000000000001';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE TYPE public.app_role AS ENUM ('admin','player');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION public.has_role(uuid, public.app_role) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT $1 = '${admin}'::uuid $$;
    CREATE TABLE public.round_robin_events (id uuid PRIMARY KEY, organizer_id uuid, status text, voided boolean DEFAULT false, current_round integer, num_rounds integer, schedule_version integer DEFAULT 0);
    CREATE TABLE public.round_robin_schedule (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid, round_no integer, is_bye boolean DEFAULT false, team1_score integer, team2_score integer, abandoned boolean DEFAULT false, voided_at timestamptz, superseded_by_schedule_id uuid);
    CREATE TABLE public.round_robin_audit (event_id uuid, editor_id uuid, change_type text, changes jsonb, reason text);
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
  `);
  const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20260915100000_atomic_round_robin_round_completion.sql'), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // safe to reapply
}, 30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE round_robin_schedule, round_robin_events, round_robin_audit;');
  await db.query("INSERT INTO round_robin_events(id,organizer_id,status,current_round,num_rounds) VALUES($1,$2,'live',1,3)", [event,owner]);
  await db.query('INSERT INTO round_robin_schedule(event_id,round_no,team1_score,team2_score) VALUES ($1,1,11,8),($1,1,11,6),($1,2,null,null)', [event]);
});
afterAll(async () => { await db?.close(); });
async function closeRound(actor = owner, round: number | null = 1, role = 'authenticated') {
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [actor]);
  await db.exec(`SET ROLE ${role}`);
  try { return (await db.query<{ next: number }>('SELECT rr_close_round($1,$2) AS next', [event,round])).rows[0].next; }
  finally { await db.exec('RESET ROLE'); }
}
async function current() { return (await db.query<{ current_round: number; schedule_version: number }>('SELECT current_round,schedule_version FROM round_robin_events')).rows[0]; }

describe('atomic round completion', () => {
  it('advances exactly one round and records the actor in the same transaction', async () => {
    expect(await closeRound()).toBe(2);
    expect(await current()).toEqual({ current_round: 2, schedule_version: 1 });
    const audit = (await db.query('SELECT * FROM round_robin_audit')).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ editor_id: owner, change_type: 'round_close', changes: { closed_round: 1, current_round: 2 } });
  });
  it('does not advance twice when a stale page or double click repeats a request', async () => {
    await closeRound();
    await expect(closeRound()).rejects.toThrow('active round changed');
    expect((await current()).current_round).toBe(2);
  });
  it('allows a platform admin', async () => { expect(await closeRound(admin)).toBe(2); });
  it('rejects another signed-in player', async () => {
    await expect(closeRound(outsider)).rejects.toThrow('Only the organizer');
    expect((await current()).current_round).toBe(1);
  });
  it('does not expose the mutation to anonymous displays', async () => {
    await expect(closeRound('',1,'anon')).rejects.toThrow('permission denied');
    await expect(closeRound('')).rejects.toThrow('Sign in again');
  });
  it.each([null,0,-1])('rejects invalid expected round %s', async round => { await expect(closeRound(owner,round)).rejects.toThrow('valid active round'); });
  it.each(['draft','completed','voided'])('rejects a %s event', async status => {
    await db.query('UPDATE round_robin_events SET status=$1',[status]);
    await expect(closeRound()).rejects.toThrow('Only a live event');
  });
  it('rejects a voided event whose old status is still live', async () => {
    await db.exec('UPDATE round_robin_events SET voided=true');
    await expect(closeRound()).rejects.toThrow('Only a live event');
  });
  it('requires both saved scores on every played court', async () => {
    await db.exec('UPDATE round_robin_schedule SET team2_score=null WHERE round_no=1');
    await expect(closeRound()).rejects.toThrow('2 remaining');
    expect((await current()).current_round).toBe(1);
  });
  it('treats abandoned games as resolved without inventing scores', async () => {
    await db.exec('UPDATE round_robin_schedule SET team1_score=null,team2_score=null,abandoned=true WHERE round_no=1');
    expect(await closeRound()).toBe(2);
  });
  it('ignores byes, voided and superseded history', async () => {
    await db.query("INSERT INTO round_robin_schedule(event_id,round_no,is_bye,voided_at,superseded_by_schedule_id) VALUES ($1,1,true,null,null),($1,1,false,now(),null),($1,1,false,null,gen_random_uuid())", [event]);
    expect(await closeRound()).toBe(2);
  });
  it('cannot close an empty round using every([])', async () => {
    await db.exec('DELETE FROM round_robin_schedule WHERE round_no=1');
    await expect(closeRound()).rejects.toThrow('no matches');
  });
  it('cannot activate a missing next-round schedule', async () => {
    await db.exec('DELETE FROM round_robin_schedule WHERE round_no=2');
    await expect(closeRound()).rejects.toThrow('next round has no schedule');
  });
  it('keeps final-event completion a separate deliberate action', async () => {
    await db.exec('UPDATE round_robin_events SET num_rounds=1');
    await expect(closeRound()).rejects.toThrow('final round');
  });
  it('rolls back advancement if its audit fails', async () => {
    await db.exec("ALTER TABLE round_robin_audit ADD CONSTRAINT reject_audit CHECK (change_type <> 'round_close')");
    try {
      await expect(closeRound()).rejects.toThrow('reject_audit');
      expect(await current()).toEqual({ current_round: 1, schedule_version: 0 });
    } finally { await db.exec('ALTER TABLE round_robin_audit DROP CONSTRAINT reject_audit'); }
  });
});
