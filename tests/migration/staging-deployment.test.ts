import { describe, expect, it } from 'vitest';
import { prepareStagingMigration, deployStagingMigrations } from '../../scripts/deploy-supabase-staging.mjs';
import { readLocalMigrations } from '../../scripts/deploy-supabase-migrations.mjs';
import { STAGING_SUPABASE_PROJECT } from '../../scripts/staging-target.mjs';
import { fileURLToPath } from 'node:url';

const migration = { version: '20260922200000', name: 'example', filename: '20260922200000_example.sql', sql: "BEGIN; SELECT 'https://rqfqwavhtfwwtmfjnxkx.supabase.co/functions/v1/example'; COMMIT;" };
describe('independent staging migration preparation', () => {
  it('binds endpoint literals to staging and disables jobs before recording/committing', () => {
    const sql = prepareStagingMigration(migration, STAGING_SUPABASE_PROJECT);
    expect(sql).not.toContain('rqfqwavhtfwwtmfjnxkx');
    expect(sql).toContain('https://svdpujbstxiaunoeqlee.supabase.co/functions/v1/example');
    expect(sql.indexOf('UPDATE cron.job SET active = false')).toBeLessThan(sql.indexOf('INSERT INTO supabase_migrations'));
    expect(sql.trim().endsWith('COMMIT;')).toBe(true);
    expect(migration.sql).toContain('rqfqwavhtfwwtmfjnxkx');
  });
  it('blocks another backend, including a retired one', () => {
    expect(() => prepareStagingMigration({ ...migration, sql: "SELECT 'https://ryxklkayezjnwwunuphn.supabase.co';" }, STAGING_SUPABASE_PROJECT)).toThrow('Unreviewed external');
    expect(() => prepareStagingMigration(migration, 'rqfqwavhtfwwtmfjnxkx')).toThrow('No production fixture writes');
  });
  it('prepares every repository migration without changing historical files', async () => {
    const local = await readLocalMigrations(fileURLToPath(new URL('../../supabase/migrations', import.meta.url)));
    expect(local.length).toBeGreaterThan(400);
    for (const entry of local) expect(prepareStagingMigration(entry, STAGING_SUPABASE_PROJECT)).not.toContain('https://rqfqwavhtfwwtmfjnxkx.supabase.co');
  });
  it('refuses production before any request', async () => {
    let requests = 0;
    await expect(deployStagingMigrations({ projectRef: 'rqfqwavhtfwwtmfjnxkx', accessToken: 'sbp_fixture', migrationsDirectory: '', fetchImpl: async () => { requests++; } })).rejects.toThrow('No production fixture writes');
    expect(requests).toBe(0);
  });
  it('does not initialize history or apply SQL in default plan mode', async () => {
    const requests: { read_only: boolean; query: string }[] = [];
    const result = await deployStagingMigrations({ projectRef: STAGING_SUPABASE_PROJECT, accessToken: 'sbp_fixture',
      migrationsDirectory: fileURLToPath(new URL('../../supabase/migrations', import.meta.url)),
      fetchImpl: async (_url: string, init: RequestInit) => { requests.push(JSON.parse(String(init.body))); return new Response(JSON.stringify([{ installed: false }])); },
    });
    expect(result.applied).toEqual([]);
    expect(result.pending.length).toBeGreaterThan(400);
    expect(requests).toHaveLength(1);
    expect(requests.every(request => request.read_only)).toBe(true);
  });
});
