import { backendConfig } from '@/integrations/supabase/config';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { createSafeAuthStorage, getSupabaseAuthStorageKey } from '@/lib/supabaseAuthStorage';

const SUPABASE_URL = backendConfig.url;
const SUPABASE_PUBLISHABLE_KEY = backendConfig.publishableKey;
const SUPABASE_PROJECT_ID = backendConfig.projectId;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: createSafeAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    // Never reuse a JWT across Supabase projects. During a backend cutover a
    // shared key causes the old project's token to be sent to the new issuer,
    // producing repeated bad_jwt responses and an auth/dashboard flash loop.
    storageKey: getSupabaseAuthStorageKey(SUPABASE_PROJECT_ID, SUPABASE_URL),
    flowType: 'pkce',
  }
});
