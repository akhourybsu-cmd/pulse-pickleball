import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-guests-qa',
  optimizeDeps: { entries: ['tests/guests/browser/index.html'] },
  resolve: { alias: [
    ...['integrations/supabase/client', 'hooks/useAuthState', 'hooks/useFriends', 'hooks/useGroupMembers', 'hooks/useRecentCoPlayers'].map(name => ({ find: `@/${name}`, replacement: path.resolve(__dirname, 'stub.ts') })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
