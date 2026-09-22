import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashEmailCode } from '../../supabase/functions/_shared/mfa';

const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const s1 = '20000000-0000-4000-8000-000000000001';
const s2 = '20000000-0000-4000-8000-000000000002';
const sb = '20000000-0000-4000-8000-000000000003';
const challenge = '30000000-0000-4000-8000-000000000001';
let db: PGlite;
async function actor(uid = a, sid = s1, aal = 'aal1', role = 'authenticated') {
  await db.exec('RESET ROLE');
  await db.query("SELECT set_config('request.jwt.claims', $1, false), set_config('request.path', '/profiles', false)", [JSON.stringify({ sub: uid, session_id: sid, aal, role })]);
  await db.exec(`SET ROLE ${role}`);
}
async function admin(sql: string, params: unknown[] = []) { await db.exec('RESET ROLE'); return db.query(sql, params); }
async function status() { return (await db.query<{ value: { verified: boolean; method: string; error?: string } }>('SELECT public.pulse_mfa_status() AS value')).rows[0].value; }
async function issue(id = challenge, purpose = 'sign_in', sid = s1) {
  await actor(a, sid, 'aal1', 'service_role');
  return (await db.query<{ value: { ok: boolean; error?: string; email?: string } }>('SELECT public.pulse_issue_mfa_email($1,$2,$3,$4,$5) AS value', [a, sid, id, await hashEmailCode(id, '123456'), purpose])).rows[0].value;
}
async function verify(id = challenge, sid = s1, uid = a, code = '123456') {
  await actor(uid, sid, 'aal1', 'service_role');
  return (await db.query<{ value: { ok: boolean; error?: string } }>('SELECT public.pulse_verify_mfa_email($1,$2,$3,$4) AS value', [uid, sid, id, await hashEmailCode(id, code)])).rows[0].value;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE authenticator;
    CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA realtime;
    GRANT USAGE ON SCHEMA auth, public, storage, realtime TO authenticated, service_role, anon;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users);
    CREATE TABLE auth.mfa_factors(id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users, status text, factor_type text);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users, mfa_method text DEFAULT 'none');
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_profile ON public.profiles TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
    GRANT SELECT, UPDATE ON public.profiles TO authenticated;
    CREATE TABLE public.private_data(user_id uuid, content text);
    ALTER TABLE public.private_data ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_data ON public.private_data TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    GRANT SELECT, INSERT ON public.private_data TO authenticated;
    CREATE TABLE public.lookup(value text); GRANT SELECT ON public.lookup TO authenticated, anon;
    CREATE TABLE storage.objects(owner uuid); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_object ON storage.objects TO authenticated USING (owner = auth.uid()); GRANT SELECT ON storage.objects TO authenticated;
    CREATE TABLE realtime.messages(owner uuid); ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_message ON realtime.messages TO authenticated USING (owner = auth.uid()); GRANT SELECT ON realtime.messages TO authenticated;
    CREATE TABLE public.mfa_verification_codes(code text); GRANT ALL ON public.mfa_verification_codes TO authenticated;
    CREATE FUNCTION public.insert_mfa_code(uuid,text,text,timestamptz) RETURNS uuid LANGUAGE sql AS $$ SELECT $1 $$;
    CREATE FUNCTION public.verify_and_use_mfa_code(uuid,text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
  `);
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260922200000_enforce_session_mfa.sql', import.meta.url), 'utf8'));
}, 30_000);
beforeEach(async () => {
  await admin('TRUNCATE auth.users CASCADE');
  await admin('TRUNCATE public.private_data, public.lookup, storage.objects, realtime.messages');
  await admin("INSERT INTO auth.users VALUES ($1,'a@example.test',now()),($2,'b@example.test',now())", [a, b]);
  await admin('INSERT INTO auth.sessions VALUES ($1,$2),($3,$2),($4,$5)', [s1, a, s2, sb, b]);
  await admin("INSERT INTO public.profiles VALUES ($1,'email'),($2,'none')", [a, b]);
  await admin("INSERT INTO public.private_data VALUES ($1,'A'),($2,'B')", [a, b]);
  await admin("INSERT INTO public.lookup VALUES ('public')");
  await admin('INSERT INTO storage.objects VALUES ($1),($2)', [a, b]);
  await admin('INSERT INTO realtime.messages VALUES ($1),($2)', [a, b]);
});
afterAll(async () => { await db?.close(); });

describe('server-enforced session verification', () => {
  it('blocks opted-in users at row policies and pre-request while allowing their status check', async () => {
    await actor(); expect((await status()).verified).toBe(false);
    for (const table of ['profiles', 'private_data', 'lookup', 'storage.objects', 'realtime.messages']) expect((await db.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
    await expect(db.query('SELECT public.pulse_enforce_mfa()')).rejects.toMatchObject({ code: '42501' });
    await db.query("SELECT set_config('request.path', '/rpc/pulse_mfa_status', false)");
    await expect(db.query('SELECT public.pulse_enforce_mfa()')).resolves.toBeDefined();
  });
  it('retains existing authorization for non-MFA and anonymous public access', async () => {
    await actor(b, sb); expect((await status()).verified).toBe(true);
    expect((await db.query('SELECT content FROM private_data')).rows).toEqual([{ content: 'B' }]);
    await actor(b, sb, 'aal1', 'anon');
    expect((await db.query('SELECT * FROM lookup')).rows).toHaveLength(1);
    await expect(db.query('SELECT public.pulse_mfa_status()')).rejects.toMatchObject({ code: '42501' });
  });
  it('binds a successful code to one live session, not the entire account', async () => {
    expect(await issue()).toMatchObject({ ok: true, email: 'a@example.test' });
    expect(await verify(challenge, s2)).toMatchObject({ ok: false });
    expect(await verify()).toMatchObject({ ok: true });
    await actor(); expect((await status()).verified).toBe(true);
    expect((await db.query('SELECT content FROM private_data')).rows).toEqual([{ content: 'A' }]);
    await actor(a, s2); expect((await status()).verified).toBe(false);
    expect(await verify()).toMatchObject({ ok: false });
  });
  it('does not verify a code for another account or permit access after logout/email change', async () => {
    await issue(); expect(await verify(challenge, sb, b)).toMatchObject({ ok: false });
    await verify(); await admin("UPDATE auth.users SET email='changed@example.test' WHERE id=$1", [a]);
    await actor(); expect((await status()).verified).toBe(false);
    await admin('DELETE FROM auth.sessions WHERE id=$1', [s1]);
    await actor(); expect((await status()).error).toBe('sign_in_required');
  });
  it('expires both challenge and proof, and resend invalidates older codes', async () => {
    await issue(); await admin("UPDATE pulse_security.email_challenges SET expires_at=now()-interval '1 second'");
    expect(await verify()).toMatchObject({ ok: false });
    await issue(); const next = '30000000-0000-4000-8000-000000000002'; await issue(next);
    expect(await verify()).toMatchObject({ ok: false }); expect(await verify(next)).toMatchObject({ ok: true });
    await admin("UPDATE pulse_security.email_proofs SET expires_at=now()-interval '1 second'");
    await actor(); expect((await status()).verified).toBe(false);
  });
  it('rate limits invalid verification attempts across resends and sessions', async () => {
    await issue();
    for (let i = 0; i < 10; i++) expect(await verify(challenge, s1, a, '000000')).toMatchObject({ ok: false, error: 'invalid_code' });
    expect(await verify()).toMatchObject({ error: 'rate_limited' });
    expect(await issue(challenge, 'sign_in', s2)).toMatchObject({ error: 'rate_limited' });
  });
  it('limits sends in shared database state rather than per edge instance', async () => {
    for (let i = 0; i < 5; i++) expect(await issue()).toMatchObject({ ok: true });
    expect(await issue()).toMatchObject({ error: 'rate_limited' });
  });
  it('rejects malformed, missing and differently owned session IDs', async () => {
    for (const sid of ['', 'invalid', sb]) {
      await actor(a, sid);
      expect(await status()).toMatchObject({ verified: false, error: 'sign_in_required' });
    }
  });
  it('requires a confirmed recipient and rechecks the method when a code is consumed', async () => {
    await admin('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [a]);
    expect(await issue()).toMatchObject({ ok: false, error: 'sign_in_required' });
    await admin('UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1', [a]);
    await issue();
    await admin("INSERT INTO auth.mfa_factors VALUES ($1,$2,'verified','totp')", [challenge, a]);
    expect(await verify()).toMatchObject({ ok: false, error: 'method_changed' });
    await actor(); expect((await status()).verified).toBe(false);
  });
  it('preserves a valid proof across token refresh but clears it when email protection is disabled', async () => {
    await issue(); await verify();
    await actor(); expect((await status()).verified).toBe(true);
    await actor(a, s1); expect((await status()).verified).toBe(true);
    await db.query("UPDATE profiles SET mfa_method='none' WHERE id=$1", [a]);
    const proofs = await admin('SELECT * FROM pulse_security.email_proofs');
    expect(proofs.rows).toHaveLength(0);
    await actor(a, s2); expect(await status()).toMatchObject({ method: 'none', verified: true });
  });
  it('requires successful email enrollment and disallows client-written MFA settings', async () => {
    await actor(b, sb);
    await expect(db.query("UPDATE profiles SET mfa_method='email' WHERE id=$1", [b])).rejects.toMatchObject({ code: '42501' });
    await actor(a, s1, 'aal1', 'service_role');
    await admin("SELECT set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: 'service_role' })]);
    await admin("UPDATE profiles SET mfa_method='none' WHERE id=$1", [a]);
    expect(await issue(challenge, 'enroll')).toMatchObject({ ok: true });
    expect(await verify()).toMatchObject({ ok: true });
    await actor(); expect(await status()).toMatchObject({ method: 'email', verified: true });
    await db.query("UPDATE profiles SET mfa_method='none' WHERE id=$1", [a]);
    expect((await status()).method).toBe('none');
  });
  it('uses real verified factors even if the profile says none, and requires aal2', async () => {
    await admin("INSERT INTO auth.mfa_factors VALUES ($1,$2,'verified','totp')", [challenge, b]);
    await actor(b, sb); expect(await status()).toMatchObject({ method: 'authenticator', verified: false });
    await actor(b, sb, 'aal2'); expect((await status()).verified).toBe(true);
    await expect(db.query("UPDATE profiles SET mfa_method='email' WHERE id=$1", [b])).rejects.toMatchObject({ code: '42501' });
  });
  it('revokes legacy code minting, proof writes and service-only calls from browser roles', async () => {
    await actor(b, sb);
    await expect(db.query("SELECT insert_mfa_code($1,'123456','email',now())", [a])).rejects.toMatchObject({ code: '42501' });
    await expect(db.query("SELECT verify_and_use_mfa_code($1,'123456','email')", [a])).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('SELECT * FROM pulse_security.email_proofs')).rejects.toMatchObject({ code: '42501' });
    await expect(db.query('SELECT pulse_verify_mfa_email($1,$2,$3,$4)', [a, s1, challenge, 'hash'])).rejects.toMatchObject({ code: '42501' });
  });
});
