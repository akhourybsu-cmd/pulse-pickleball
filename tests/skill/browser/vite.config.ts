import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()], cacheDir: 'node_modules/.vite-skill-qa',
  define: { 'import.meta.env.VITE_SKILL_ASSESSMENT': JSON.stringify('on') },
  optimizeDeps: { entries: ['tests/skill/browser/index.html'] },
  resolve: { alias: [
    { find: '@/integrations/supabase/client', replacement: path.resolve(__dirname, 'stub.ts') },
    { find: '@/hooks/useAuthState', replacement: path.resolve(__dirname, 'stub.ts') },
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
