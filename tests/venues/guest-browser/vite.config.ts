import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const stub = path.resolve(__dirname, 'stub.tsx');
export default defineConfig({
  plugins: [react()], cacheDir: '.qa-cache',
  optimizeDeps: { entries: ['tests/venues/guest-browser/index.html'] },
  resolve: { alias: [
    ...['integrations/supabase/client', 'hooks/useAuthState', 'pages/player/GroupRoute', 'pages/player/Community', 'components/layout/PlayerAppShell'].map(name => ({ find: `@/${name}`, replacement: stub })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
