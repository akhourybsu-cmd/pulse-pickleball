import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const stub = path.resolve(__dirname,'stub.ts');
export default defineConfig({plugins:[react()],cacheDir:'.qa-cache/public-venue-vite',optimizeDeps:{entries:['tests/venues/public-browser/index.html']},resolve:{alias:[...['hooks/useAuthState','hooks/usePublicCommunity','integrations/supabase/client'].map(name=>({find:`@/${name}`,replacement:stub})),{find:'@',replacement:path.resolve(__dirname,'../../../src')}]}});
