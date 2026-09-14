import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Local-only responsive QA of the real profile; no authenticated backend calls.
const stub = path.resolve(__dirname, 'stub.ts');
export default defineConfig({
  plugins: [react()],
  cacheDir: 'node_modules/.vite-profile-qa',
  optimizeDeps: { entries: ['tests/profile/browser/index.html'] },
  resolve: { alias: [
    ...['integrations/supabase/client', 'lib/permissions', 'lib/skill/featureFlag'].map(name => ({ find: `@/${name}`, replacement: stub })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
