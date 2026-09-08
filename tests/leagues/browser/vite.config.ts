import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Isolated browser QA: real components, in-memory fixtures, no live backend.
const stub = path.resolve(__dirname, 'stub.tsx');
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-league-qa',
  optimizeDeps: { entries: ['tests/leagues/browser/index.html'] },
  resolve: { alias: [
    { find: /^\.\/useAuthState$/, replacement: stub },
    ...['hooks/useAuthState', 'integrations/supabase/client', 'lib/skill/featureFlag'].map(name => ({find:`@/${name}`,replacement:stub})),
    { find:'@', replacement:path.resolve(__dirname,'../../../src') },
  ] },
});
