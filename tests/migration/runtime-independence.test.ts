import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const root = new URL('../../', import.meta.url);
function files(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? files(url) : /\.(ts|tsx|js|mjs|json|toml|yml)$/.test(entry.name) ? [url] : [];
  });
}
describe('PULSE runs independently of Lovable', () => {
  it('has no Lovable gateway, credential, client package or hosting origin in runtime/deployment code', () => {
    const paths = [...files(new URL('src/', root)), ...files(new URL('supabase/functions/', root)), ...files(new URL('.github/workflows/', root)), ...['package.json', 'vite.config.ts', 'firebase.json', 'supabase/config.toml'].map(path => new URL(path, root))];
    const forbidden = /LOVABLE_API_KEY|lovable-tagger|@lovable\/|https?:\/\/[^\s'"<>]*\b(?:lovable\.dev|lovable\.app|lovableproject\.com)/i;
    const violations = paths.filter(file => forbidden.test(readFileSync(file, 'utf8'))).map(file => file.pathname.slice(root.pathname.length));
    expect(violations).toEqual([]);
  });
  it('uses the independent production backend and Firebase deployment', () => {
    const production = readFileSync(new URL('.env.production', root), 'utf8');
    expect(/^VITE_SUPABASE_PROJECT_ID=["']?rqfqwavhtfwwtmfjnxkx["']?\s*$/m.test(production)).toBe(true);
    expect(readFileSync(new URL('.github/workflows/firebase-hosting-deploy.yml', root), 'utf8')).toContain('FirebaseExtended/action-hosting-deploy');
    expect(readFileSync(new URL('.github/workflows/supabase-deploy.yml', root), 'utf8')).toContain('supabase functions deploy');
  });
});
