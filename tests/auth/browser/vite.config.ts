import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-auth-recovery-qa',
  optimizeDeps: { entries: ['tests/auth/browser/index.html'] },
  resolve: { alias: [
    { find: '@/integrations/supabase/client', replacement: path.resolve(__dirname, 'stub.ts') },
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
