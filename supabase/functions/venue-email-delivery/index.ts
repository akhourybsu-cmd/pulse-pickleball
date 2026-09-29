import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { isServiceRoleRequest } from "../_shared/service-role-auth.ts";
import { processVenueEmail } from "../venue-email/worker.ts";
const url = Deno.env.get("SUPABASE_URL")!,
  key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
Deno.serve(async (req) => {
  if (req.method !== "POST")
    return new Response("{}", { status: 405, headers });
  const server = await isServiceRoleRequest(
    req,
    key,
    Deno.env.get("SUPABASE_SECRET_KEYS"),
  );
  const scheduled = server
    ? null
    : await db.rpc("is_valid_scheduled_task_secret", {
        p_secret: req.headers.get("x-dispatch-secret") || "",
      });
  if (!server && (scheduled?.error || scheduled?.data !== true))
    return new Response("{}", { status: 401, headers });
  try {
    const result = await processVenueEmail({
      baseUrl: url,
      managedKey: Deno.env.get("RESEND_API_KEY"),
      rpc: async (name, args) => {
        const { data, error } = await db.rpc(name, args);
        if (error) throw new Error("Delivery operation failed");
        return data;
      },
    });
    return new Response(JSON.stringify(result), { headers });
  } catch {
    return new Response(
      JSON.stringify({ error: "Email delivery could not complete." }),
      { status: 503, headers },
    );
  }
});
