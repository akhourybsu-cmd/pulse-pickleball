import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';

// Isolated real-component QA. All backend access is replaced by local fixtures.
const stub = path.resolve(__dirname, 'stub.ts');
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-venue-booking-qa',
  optimizeDeps: { entries: ['tests/venues/browser/index.html'] },
  resolve: { alias: [
    ...['integrations/supabase/client', 'hooks/useAuthState', 'lib/payments'].map(name => ({ find: `@/${name}`, replacement: stub })),
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
