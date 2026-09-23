import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const fixture = path.resolve(__dirname, 'leagueFixture.ts');
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-marketing-qa',
  define: { 'import.meta.env.VITE_SKILL_ASSESSMENT': JSON.stringify('on') },
  optimizeDeps: { entries: ['tests/marketing/browser/index.html'] },
  resolve: { alias: [
    ...['hooks/useLeagueDetailForPlayer', 'integrations/supabase/client'].map(name => ({ find: `@/${name}`, replacement: fixture })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
