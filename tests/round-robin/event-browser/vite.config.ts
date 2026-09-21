import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const stub = path.resolve(__dirname, 'stub.ts');
const creationStub = path.resolve(__dirname, '../browser/stub.ts');
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-rr-event-qa',
  optimizeDeps: { entries: ['tests/round-robin/event-browser/index.html'] },
  resolve: { alias: [
    ...['integrations/supabase/client', 'hooks/useAuthState'].map(name => ({ find: `@/${name}`, replacement: stub })),
    ...['hooks/useFriends', 'hooks/useGroupMembers', 'hooks/useRecentCoPlayers', 'hooks/useAdminGroups'].map(name => ({ find: `@/${name}`, replacement: creationStub })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
