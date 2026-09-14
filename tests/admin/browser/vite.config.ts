import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
const stub=path.resolve(__dirname,'stub.ts');
export default defineConfig({ plugins:[react()],cacheDir:'node_modules/.vite-admin-qa',optimizeDeps:{entries:['tests/admin/browser/index.html']},resolve:{alias:[
  ...['integrations/supabase/client','hooks/useAuthState'].map(name=>({find:'@/'+name,replacement:stub})),
  {find:'@',replacement:path.resolve(__dirname,'../../../src')}
]}});

