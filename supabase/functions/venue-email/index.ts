import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { requireCallerMfa } from "../_shared/mfa.ts";
import {
  createVenueEmailHandler,
  emailHeaders,
  safeSetupError,
} from "./handler.ts";
import { processVenueEmail } from "./worker.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rpc = async (name: string, args: Record<string, unknown>) => {
  const { data, error } = await service.rpc(name, args);
  if (error) throw safeSetupError(error.message);
  return data;
};
Deno.serve(
  createVenueEmailHandler({
    rpc,
    async authorize(req, venue) {
      const mfaDenial = await requireCallerMfa(req);
      if (mfaDenial) return mfaDenial;
      const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: {
          headers: { Authorization: req.headers.get("Authorization") || "" },
        },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error,
      } = await caller.auth.getUser();
      if (error || !user || user.is_anonymous)
        return new Response(JSON.stringify({ error: "Sign in to continue." }), {
          status: 401,
          headers: emailHeaders,
        });
      const check = await caller.rpc("venue_email_workspace", {
        p_venue: venue,
      });
      if (check.error || !check.data?.eligible)
        return new Response(
          JSON.stringify({
            error: "Active verified venue management required.",
          }),
          { status: 403, headers: emailHeaders },
        );
      return { actor: user.id };
    },
    process: (job) =>
      processVenueEmail(
        { rpc, managedKey: Deno.env.get("RESEND_API_KEY"), baseUrl: url },
        job,
        1,
      ),
  }),
);
