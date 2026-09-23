import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const root = new URL('../../supabase/functions/', import.meta.url);
describe('user-authenticated edge coverage', () => {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '_shared') continue;
    let source: string;
    try { source = readFileSync(new URL(`${entry.name}/index.ts`, root), 'utf8'); } catch { continue; }
    if (!/\.auth\.getUser\(/.test(source)) continue;
    it(`${entry.name} checks session assurance before authenticated work`, () => {
      const guard = source.indexOf('await requireCallerMfa(req)');
      expect(guard).toBeGreaterThan(-1);
      expect(guard).toBeLessThan(source.search(/\.auth\.getUser\(/));
      expect(source).toContain('if (mfaDenial) return mfaDenial');
    });
  }
  it('checks shared payment authentication without converting a denial to success', () => {
    const runtime = readFileSync(new URL('_shared/payment-runtime.ts', root), 'utf8');
    expect(runtime).toContain('await readCallerMfa(req)');
    expect(runtime).toContain("if (!security.verified) throw new MfaAccessError(403, 'mfa_required')");
    expect(runtime).toContain('data.user.id !== security.userId');
  });
});
