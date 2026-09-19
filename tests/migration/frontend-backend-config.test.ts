import { describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';
import { PRODUCTION_SUPABASE_PROJECT, PRODUCTION_SUPABASE_URL, validateProductionSupabase } from '../../scripts/validate-supabase-config.mjs';

const token = (ref: string, role = 'anon') => `header.${Buffer.from(JSON.stringify({ ref, role })).toString('base64url')}.signature`;
const config = () => ({
  VITE_SUPABASE_PROJECT_ID: PRODUCTION_SUPABASE_PROJECT,
  VITE_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: token(PRODUCTION_SUPABASE_PROJECT),
});

describe('PULSE production backend configuration', () => {
  it('accepts the current project and its public anon key', () => {
    expect(() => validateProductionSupabase(config())).not.toThrow();
  });
  it('accepts the publishable key format', () => {
    expect(() => validateProductionSupabase({ ...config(), VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture' })).not.toThrow();
  });
  it('rejects the retired backend even when the URL and project ID agree', () => {
    expect(() => validateProductionSupabase({
      VITE_SUPABASE_PROJECT_ID: 'ryxklkayezjnwwunuphn',
      VITE_SUPABASE_URL: 'https://ryxklkayezjnwwunuphn.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: token('ryxklkayezjnwwunuphn'),
    })).toThrow(/must use Supabase project/);
  });
  it('rejects a mismatched ID, URL, or legacy anon key', () => {
    for (const bad of [
      { VITE_SUPABASE_PROJECT_ID: 'wrong-project' },
      { VITE_SUPABASE_URL: 'https://wrong-project.supabase.co' },
      { VITE_SUPABASE_PUBLISHABLE_KEY: token('wrong-project') },
    ]) expect(() => validateProductionSupabase({ ...config(), ...bad })).toThrow();
  });
  it('rejects missing, malformed, or server credentials without printing them', () => {
    for (const key of ['', 'malformed-key', 'sb_secret_server-only', token(PRODUCTION_SUPABASE_PROJECT, 'service_role')]) {
      expect(() => validateProductionSupabase({ ...config(), VITE_SUPABASE_PUBLISHABLE_KEY: key })).toThrow();
      try {
        validateProductionSupabase({ ...config(), VITE_SUPABASE_PUBLISHABLE_KEY: key });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        if (key) expect((error as Error).message).not.toContain(key);
      }
    }
  });
  it('loads a valid production configuration from the repository', () => {
    expect(() => validateProductionSupabase(loadEnv('production', process.cwd(), 'VITE_SUPABASE_'))).not.toThrow();
  });
});
