import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({
  plugins: [react()], cacheDir: '.qa-cache/rally',
  optimizeDeps: { entries: ['tests/venues/rally-browser/index.html'] },
  resolve: { alias: [
    { find: '@/hooks/useAuthState', replacement: path.resolve(__dirname, 'auth.ts') },
    { find: '@', replacement: path.resolve(__dirname, '../../../src') },
  ] },
});
