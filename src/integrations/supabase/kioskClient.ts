import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// The TV only reads data already made public by the live/completed-event
// policies. Never attach the host's session or refresh token to kiosk reads.
export const kioskClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    // This disables creation of a second GoTrue auth client entirely. The
    // SDK falls back to the public anon key when no access token is supplied.
    accessToken: async () => null,
    global: {
      fetch: async (input, init) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        const signal = init?.signal;
        if (signal?.aborted) abort();
        signal?.addEventListener('abort', abort, { once: true });
        const timeout = setTimeout(abort, 20_000);
        try { return await fetch(input, { ...init, signal: controller.signal }); }
        finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
      },
    },
  },
);
