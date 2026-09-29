import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createVenueUnsubscribeHandler } from "./handler.ts";
const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
Deno.serve(
  createVenueUnsubscribeHandler(async (token) => {
    const { data, error } = await db.rpc("venue_email_unsubscribe", {
      p_token: token,
    });
    if (error) throw new Error("Preference update failed");
    return data === true;
  }),
);
