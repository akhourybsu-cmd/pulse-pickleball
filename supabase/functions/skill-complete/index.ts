// =====================================================================
// skill-complete  (server-authoritative PULSE Skill Assessment completion)
//
// The browser may show a PROVISIONAL preview, but it is never trusted.
// This function independently recomputes the result from the AUTHORITATIVE
// stored responses + the versioned question bank, using the same shared
// scoring engine the client uses (mirrored in _shared/skill), then persists
// it in one protected RPC transaction.
//
// The client sends ONLY: { attemptId, finalResponses? }. No score/level a
// client might supply is ever read — only each item's response_key.
//
// Guarantees:
//   • Rejects: another player's attempt, invalid states, unsupported
//     versions, unknown/inactive item refs, missing responses.
//   • Idempotent: repeating a completed attempt returns the STORED snapshot
//     (no recompute, no duplicate) — safe across timeout/refresh/retry.
//   • Writes run under the service role; the finalize RPC is service-only.
//
// Body: { "attemptId": "<uuid>", "finalResponses": { "<item_key>": "<response_key>" } }
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RESPONSE_MASTERY, type ResponseKey } from "../_shared/skill/model.ts";
import { computeAuthoritativeResult, type StoredResponse } from "../_shared/skill/complete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    // Identify the caller from their JWT (never trust a body-supplied id).
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "unauthorized" }, 401);

    // Service role for authoritative reads/writes (RLS-independent).
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const attemptId: string | undefined = body?.attemptId;
    const finalResponses: Record<string, string> | undefined = body?.finalResponses;
    if (!attemptId) return json({ error: "attemptId required" }, 400);

    // ---- load attempt + authorize ------------------------------------
    const { data: attempt } = await admin
      .from("skill_assessment_attempts").select("*").eq("id", attemptId).maybeSingle();
    if (!attempt) return json({ error: "attempt_not_found" }, 404);
    if (attempt.player_id !== user.id) return json({ error: "forbidden" }, 403);

    // ---- idempotency: already completed → return stored result -------
    if (attempt.status === "completed") {
      return json({ authoritative: true, idempotent: true, snapshot: attempt.scoring_snapshot });
    }
    if (attempt.status !== "in_progress") return json({ error: "invalid_state", state: attempt.status }, 409);

    // ---- persist any final unsaved answers (response_key only) -------
    if (finalResponses && typeof finalResponses === "object") {
      const rows = Object.entries(finalResponses)
        .filter(([, key]) => key in RESPONSE_MASTERY)
        .map(([item_key, key]) => ({
          attempt_id: attemptId,
          item_key,
          response_key: key,
          response_value: RESPONSE_MASTERY[key as ResponseKey], // server computes; client score ignored
          was_skipped: false,
        }));
      if (rows.length) {
        const { error: upErr } = await admin
          .from("skill_assessment_responses").upsert(rows, { onConflict: "attempt_id,item_key" });
        if (upErr) return json({ error: "response_persist_failed", detail: upErr.message }, 500);
      }
    }

    // ---- load AUTHORITATIVE responses from the DB --------------------
    const { data: stored } = await admin
      .from("skill_assessment_responses").select("item_key, response_key").eq("attempt_id", attemptId);
    const responses: StoredResponse[] = (stored ?? []) as StoredResponse[];

    // ---- independent recompute ---------------------------------------
    const result = computeAuthoritativeResult({
      assessmentVersion: attempt.assessment_version,
      responses,
    });
    if (!result.ok) return json({ error: result.code, message: result.message }, 422);

    // ---- persist atomically via the service-only finalize RPC --------
    const { error: rpcErr } = await admin.rpc("apply_skill_scoring_snapshot", {
      p_attempt_id: attemptId,
      p_snapshot: result.snapshot,
    });
    if (rpcErr) return json({ error: "finalize_failed", detail: rpcErr.message }, 500);

    return json({ authoritative: true, idempotent: false, snapshot: result.snapshot });
  } catch (e) {
    return json({ error: "internal", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
