import { describe, expect, it, vi } from 'vitest';
import { checkAssessmentRelease } from '../../scripts/check-assessment-release.mjs';
import { readLocalMigrations } from '../../scripts/deploy-supabase-migrations.mjs';
import { fileURLToPath } from 'node:url';

const config = { projectRef: 'rqfqwavhtfwwtmfjnxkx', accessToken: 'sbp_test_only' };
const compatible = { unsupported_sms: 0, missing_authenticator: 0 };
const ready = { installed: true, guarded: true, policies: true, grants_closed: true };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe('assessment production release gate', () => {
  it('rejects an unintended project before using credentials', async () => {
    const fetchImpl = vi.fn();
    await expect(checkAssessmentRelease({ ...config, projectRef: 'svdpujbstxiaunoeqlee', fetchImpl })).rejects.toThrow('production');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([{ ...compatible, unsupported_sms: 1 }, { ...compatible, missing_authenticator: 1 }])('blocks incompatible account preferences without altering accounts', async state => {
    const fetchImpl = vi.fn(async () => json([state]));
    await expect(checkAssessmentRelease({ ...config, preflight: true, fetchImpl })).rejects.toThrow('account recovery');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).read_only).toBe(true);
  });
  it('rehearses only the two assessment migrations and rolls back instead of recording them', async () => {
    const local = await readLocalMigrations(fileURLToPath(new URL('../../supabase/migrations', import.meta.url)));
    const existing = local.filter(m => !['20260922180000', '20260922200000'].includes(m.version)).map(m => ({ version: m.version }));
    const bodies: { query: string; read_only: boolean }[] = [];
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)); bodies.push(body);
      return json(body.query.startsWith('BEGIN;') ? [] : body.query.includes('schema_migrations ORDER BY') ? existing : [compatible]);
    };
    await checkAssessmentRelease({ ...config, preflight: true, fetchImpl });
    const rehearsal = bodies.find(b => !b.read_only)!;
    expect(rehearsal.query).toContain('CREATE OR REPLACE FUNCTION public.import_guest_skill_assessment');
    expect(rehearsal.query).toContain('public.pulse_mfa_status');
    expect(rehearsal.query).toContain("lock_timeout = '5s'");
    expect(rehearsal.query.trim().endsWith('ROLLBACK;')).toBe(true);
    expect(rehearsal.query).not.toMatch(/COMMIT;|INSERT INTO supabase_migrations/);
    expect(bodies.filter(b => !b.read_only)).toHaveLength(1);
  });
  it('blocks publication when any installed database protection is absent', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).query;
      return json([query.includes('AS grants_closed') ? { ...ready, guarded: false } : compatible]);
    });
    await expect(checkAssessmentRelease({ ...config, fetchImpl })).rejects.toThrow('readiness failed');
    expect(fetchImpl.mock.calls.every(([url]) => url.includes('api.supabase.com'))).toBe(true);
  });
  it.each([401, 200])('accepts only deployed handlers that reject missing credentials (%s)', async status => {
    const fetchImpl = async (url: string, init: RequestInit) => {
      if (url.includes('/functions/v1/')) return json({ error: 'sign_in_required' }, status);
      const query = JSON.parse(String(init.body)).query;
      return json([query.includes('AS grants_closed') ? ready : compatible]);
    };
    const check = checkAssessmentRelease({ ...config, fetchImpl });
    if (status === 401) await expect(check).resolves.toBeUndefined();
    else await expect(check).rejects.toThrow('smoke check');
  });
});
