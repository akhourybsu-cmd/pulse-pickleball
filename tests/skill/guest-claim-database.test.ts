import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { computeGuestClaim } from '../../supabase/functions/_shared/skill/claim';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { selectNextV2 } from '../../src/lib/skill/adaptiveV2';
import type { Responses } from '../../src/lib/skill/scoring';
const player = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const attempt = '20000000-0000-4000-8000-000000000001';
const draftId = '20000000-0000-4000-8000-000000000002';
const responses: Responses = {};
while (Object.keys(responses).length < 64) { const key = selectNextV2(QUESTION_BANK_V2, responses); if (!key) break; responses[key] = 'usually'; }
const computed = computeGuestClaim({ attemptId: attempt, assessmentVersion: 2, responses });
if (!computed.ok) throw Error('Invalid test evidence');
const snapshot = computed.snapshot;
const migration = (name: string) => readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8');
let db: PGlite;
async function importReport(owner = player, id = attempt, result: unknown = snapshot) {
  return db.query('SELECT import_guest_skill_assessment($1, $2, $3::jsonb, $4::jsonb) AS snapshot', [owner, id, JSON.stringify(responses), JSON.stringify(result)]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('request.jwt.claim.role', true) $$;
    CREATE TYPE app_role AS ENUM ('admin', 'user');
    CREATE FUNCTION has_role(uuid, app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE FUNCTION is_league_admin(uuid, uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE profiles (id uuid PRIMARY KEY, current_rating numeric DEFAULT 3.25);
    CREATE TABLE leagues (id uuid PRIMARY KEY);
    CREATE TABLE league_members (league_id uuid, user_id uuid);
  `);
  await db.exec(migration('20260729123000_skill_assessment_foundation.sql'));
  await db.exec(migration('20260729232349_129918c2-769f-4e1d-82fb-8f5e60cf4dd6.sql'));
  await db.exec(migration('20260922180000_guest_skill_assessment_claim.sql'));
}, 30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE profiles CASCADE');
  await db.query('INSERT INTO profiles (id) VALUES ($1), ($2)', [player, other]);
  await db.query("SELECT set_config('request.jwt.claim.role', 'service_role', false)");
});
afterAll(async () => { await db?.close(); });

describe('atomic guest assessment transfer using production SQL', () => {
  it('stores raw answers, the full snapshot, scores and evidence while preserving the match rating', async () => {
    const saved = await importReport();
    expect(saved.rows[0].snapshot).toEqual(snapshot);
    expect((await db.query('SELECT status, assessment_version FROM skill_assessment_attempts')).rows).toEqual([{ status: 'completed', assessment_version: 2 }]);
    expect((await db.query('SELECT * FROM skill_assessment_responses')).rows).toHaveLength(Object.keys(responses).length);
    expect((await db.query('SELECT * FROM player_skill_scores')).rows).toHaveLength(16);
    expect((await db.query('SELECT * FROM skill_evidence')).rows).toHaveLength(1);
    expect((await db.query('SELECT current_rating FROM profiles WHERE id = $1', [player])).rows[0].current_rating).toBe('3.25');
    expect((await db.query('SELECT visibility FROM player_skill_profiles')).rows[0].visibility).toBe('private');
  });
  it('preserves an existing account draft and existing visibility preference', async () => {
    await db.query("INSERT INTO skill_assessment_attempts (id, player_id, assessment_version) VALUES ($1, $2, 2)", [draftId, player]);
    await db.query("INSERT INTO player_skill_profiles (player_id, visibility) VALUES ($1, 'organizers')", [player]);
    await importReport();
    expect((await db.query('SELECT status FROM skill_assessment_attempts WHERE id = $1', [draftId])).rows[0].status).toBe('in_progress');
    expect((await db.query('SELECT visibility FROM player_skill_profiles')).rows[0].visibility).toBe('organizers');
  });
  it('retries idempotently and returns the stored result even if a retry supplies a different computed result', async () => {
    await importReport();
    const again = await importReport(player, attempt, { ...snapshot, estimatedLevelRaw: 1.5 });
    expect(again.rows[0].snapshot).toEqual(snapshot);
    expect((await db.query('SELECT * FROM skill_evidence')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM skill_assessment_attempts')).rows).toHaveLength(1);
  });
  it('rejects another account claiming the same ID and rejects collision with an unfinished draft', async () => {
    await importReport();
    await expect(importReport(other)).rejects.toThrow(/another account/);
    await db.query('INSERT INTO skill_assessment_attempts (id, player_id, assessment_version) VALUES ($1, $2, 2)', [draftId, player]);
    await expect(importReport(player, draftId)).rejects.toThrow(/already in use/);
  });
  it('rolls back the attempt, responses and profile when finalization fails', async () => {
    await expect(importReport(player, attempt, { ...snapshot, subskills: [{ ...snapshot.subskills[0], rawLevel: 'invalid-numeric' }] })).rejects.toThrow();
    for (const table of ['skill_assessment_attempts', 'skill_assessment_responses', 'player_skill_profiles', 'skill_evidence']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    await expect(importReport()).resolves.toBeDefined();
  });
  it('denies direct anonymous/authenticated execution and requires a service-role context', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      try { await expect(importReport()).rejects.toThrow(/permission denied/); }
      finally { await db.exec('RESET ROLE'); }
    }
    await db.query("SELECT set_config('request.jwt.claim.role', 'authenticated', false)");
    await expect(importReport()).rejects.toThrow(/Service role required/);
  });
});
