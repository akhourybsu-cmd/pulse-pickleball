import { describe, expect, it } from 'vitest';
import { STAGING_SUPABASE_PROJECT, requireStagingJwt, requireStagingTarget } from '../../scripts/staging-target.mjs';
import { spawnSync } from 'node:child_process';

const key = (ref: string, role: string) => 'header.' + Buffer.from(JSON.stringify({ ref, role })).toString('base64url') + '.fixture';

describe('staging fixture destination', () => {
  it('requires the explicitly approved test project', () => {
    expect(requireStagingTarget(STAGING_SUPABASE_PROJECT).url).toBe('https://svdpujbstxiaunoeqlee.supabase.co');
    for (const ref of [undefined, '', 'rqfqwavhtfwwtmfjnxkx', 'ryxklkayezjnwwunuphn', 'abcdefghijklmnopqrst']) {
      expect(() => requireStagingTarget(ref)).toThrow('No production fixture writes');
    }
  });
  it('requires matching key roles and project claims without exposing secrets', () => {
    expect(() => requireStagingJwt(key(STAGING_SUPABASE_PROJECT, 'anon'), 'anon')).not.toThrow();
    expect(() => requireStagingJwt(key(STAGING_SUPABASE_PROJECT, 'service_role'), 'service_role')).not.toThrow();
    for (const secret of [key('rqfqwavhtfwwtmfjnxkx', 'service_role'), key(STAGING_SUPABASE_PROJECT, 'anon'), 'sb_secret_fixture', 'malformed']) {
      expect(() => requireStagingJwt(secret, 'service_role')).toThrow('must belong to PULSE Staging');
      try { requireStagingJwt(secret, 'service_role'); } catch (error) { expect(String(error)).not.toContain(secret); }
    }
  });
  it('the actual runner exits before any client or request on a production target', () => {
    const result = spawnSync(process.execPath, ['scripts/verify-supabase-staging.mjs', '--allow-fixtures'], {
      cwd: new URL('../../', import.meta.url), encoding: 'utf8',
      env: { ...process.env, PULSE_STAGING_PROJECT_REF: 'rqfqwavhtfwwtmfjnxkx', PULSE_STAGING_SERVICE_ROLE_KEY: 'do-not-print', PULSE_STAGING_ANON_KEY: 'do-not-print' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('No production fixture writes');
    expect(result.stderr).not.toContain('do-not-print');
  });
});
