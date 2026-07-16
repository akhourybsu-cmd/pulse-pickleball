// Slice 2b — server orchestration for round-robin participant changes.
//
// Flow (Amendment 4): authenticate -> snapshot event/players/schedule ->
// run the pure Slice 3 planner (scoreRemainingSchedule) -> preview OR call the
// transactional apply RPC (rr_manage_participant) with expected_version + the
// proposed plan + a canonical plan hash.
//
// The DB RPC is the source of truth for what is SAFE to commit: it re-locks the
// event, re-checks auth/version/idempotency, validates the plan, and applies it
// atomically. This function only decides what is PREFERABLE (via the planner)
// and translates the plan into the DB op shape the RPC understands.
//
// No pg_net/HTTP is issued from inside the RPC (Amendment 3); orchestration
// lives here, in the Edge Function, entirely outside the DB transaction.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  scoreRemainingSchedule,
  type ChangeAction,
  type PlannerEventState,
  type PlannerParticipant,
  type PlannerScheduleRow,
  type PlanOp,
  type RegenMode,
} from "../_shared/roundRobin/scoreRemainingSchedule.ts";
import type { SeatId } from "../_shared/roundRobin/scheduleCore.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface RequestBody {
  eventId: string;
  participantId: string;
  action: ChangeAction;
  substituteId?: string;
  reason?: string | null;
  regenMode?: RegenMode;
  previewOnly?: boolean;
  requestId?: string;
  /** Passed straight through to the RPC (guest payload / user_id). */
  substitute?: Record<string, unknown>;
  activeMatchResolution?: { kind: string } | null;
}

// ---- seat id <-> column helpers ------------------------------------------

const profileSeat = (id: string | null): SeatId | null => (id ? `p:${id}` : null);
const guestSeat = (id: string | null): SeatId | null => (id ? `g:${id}` : null);

/** Resolve the single seat id for a schedule slot from its two columns. */
function slotSeat(playerId: string | null, guestId: string | null): SeatId | null {
  return profileSeat(playerId) ?? guestSeat(guestId) ?? null;
}

/** Split a seat id back into { player_id, guest_id } DB columns. */
function splitSeat(seat: SeatId | null): { player_id: string | null; guest_id: string | null } {
  if (!seat) return { player_id: null, guest_id: null };
  if (seat.startsWith("p:")) return { player_id: seat.slice(2), guest_id: null };
  if (seat.startsWith("g:")) return { player_id: null, guest_id: seat.slice(2) };
  return { player_id: seat, guest_id: null };
}

// ---- canonical hash (stable, key-sorted) ---------------------------------

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- plan translation (Slice 3 shape -> DB op shape) ---------------------

function translateOps(ops: PlanOp[]): Record<string, unknown>[] {
  return ops.map((op) => {
    if (op.op === "swap_identity") {
      const from = splitSeat(op.fromSeatId);
      const to = splitSeat(op.toSeatId);
      return {
        op: "swap_identity",
        schedule_id: op.scheduleId,
        round_no: op.roundNo,
        court_no: op.courtNo,
        from_profile_id: from.player_id,
        from_guest_id: from.guest_id,
        to_profile_id: to.player_id,
        to_guest_id: to.guest_id,
      };
    }
    // rewrite_round
    return {
      op: "rewrite_round",
      round_no: op.roundNo,
      matches: op.matches.map((m) => {
        const [a1, a2, b1, b2] = m.seats;
        const sa1 = splitSeat(a1);
        const sa2 = splitSeat(a2);
        const sb1 = splitSeat(b1);
        const sb2 = splitSeat(b2);
        return {
          court_no: m.courtNo,
          is_bye: m.isBye,
          a1_player_id: sa1.player_id, a1_guest_id: sa1.guest_id,
          a2_player_id: sa2.player_id, a2_guest_id: sa2.guest_id,
          b1_player_id: sb1.player_id, b1_guest_id: sb1.guest_id,
          b2_player_id: sb2.player_id, b2_guest_id: sb2.guest_id,
        };
      }),
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: { code: "no_authorization" } }, 401);

    // Client carries the caller's JWT so both the snapshot reads (RLS) and the
    // RPC call (auth.uid()) run as the authenticated organizer.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (authErr || !user) return json({ error: { code: "not_authenticated" } }, 401);

    const body = (await req.json()) as RequestBody;
    if (!body?.eventId || !body?.participantId || !body?.action) {
      return json({ error: { code: "invalid_input", message: "eventId, participantId, action required" } }, 400);
    }
    const regenMode: RegenMode = body.regenMode ?? "auto";
    const previewOnly = body.previewOnly === true;
    const requestId = body.requestId ??
      (globalThis.crypto?.randomUUID?.() ?? `req-${user.id}-${Math.random().toString(36).slice(2)}`);

    // ---- Snapshot -------------------------------------------------------
    const [{ data: event, error: evErr }, { data: players, error: plErr }, { data: schedule, error: schErr }] =
      await Promise.all([
        supabase
          .from("round_robin_events")
          .select("id, organizer_id, current_round, schedule_version, num_courts, num_rounds, games_per_player, format, status, voided, rating_eligible")
          .eq("id", body.eventId)
          .maybeSingle(),
        supabase
          .from("round_robin_players")
          .select("id, player_id, guest_player_id, status")
          .eq("event_id", body.eventId),
        supabase
          .from("round_robin_schedule")
          .select("id, round_no, court_no, is_bye, a1_player_id, a2_player_id, b1_player_id, b2_player_id, a1_guest_id, a2_guest_id, b1_guest_id, b2_guest_id, team1_score, team2_score, locked_at, voided_at, superseded_by_schedule_id")
          .eq("event_id", body.eventId),
      ]);

    if (evErr || !event) return json({ error: { code: "event_not_found" } }, 404);
    if (plErr) return json({ error: { code: "snapshot_failed", message: plErr.message } }, 500);
    if (schErr) return json({ error: { code: "snapshot_failed", message: schErr.message } }, 500);

    // Best-effort authorization pre-check (the RPC re-checks authoritatively).
    if (event.organizer_id !== user.id) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (isAdmin !== true) return json({ error: { code: "not_authorized" } }, 403);
    }

    // ---- Gender lookup (only needed for gendered formats) ----------------
    const genders = new Map<SeatId, string>();
    if (event.format && event.format !== "open") {
      const profileIds = (players ?? []).map((p) => p.player_id).filter(Boolean) as string[];
      const guestIds = (players ?? []).map((p) => p.guest_player_id).filter(Boolean) as string[];
      if (profileIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, gender").in("id", profileIds);
        (profs ?? []).forEach((p: { id: string; gender: string | null }) => {
          if (p.gender) genders.set(`p:${p.id}`, p.gender);
        });
      }
      if (guestIds.length) {
        const { data: guests } = await supabase.from("guest_players").select("id, gender").in("id", guestIds);
        (guests ?? []).forEach((g: { id: string; gender: string | null }) => {
          if (g.gender) genders.set(`g:${g.id}`, g.gender);
        });
      }
    }

    // ---- Build planner state -------------------------------------------
    const participants: PlannerParticipant[] = (players ?? []).map((p) => {
      const seatId = slotSeat(p.player_id, p.guest_player_id);
      return {
        id: p.id,
        seatId: (seatId ?? `p:${p.id}`) as SeatId,
        status: p.status,
        gender: seatId ? genders.get(seatId) : undefined,
      };
    });

    const scheduleRows: PlannerScheduleRow[] = (schedule ?? []).map((r) => ({
      id: r.id,
      roundNo: r.round_no,
      courtNo: r.court_no,
      isBye: r.is_bye,
      seats: [
        slotSeat(r.a1_player_id, r.a1_guest_id),
        slotSeat(r.a2_player_id, r.a2_guest_id),
        slotSeat(r.b1_player_id, r.b1_guest_id),
        slotSeat(r.b2_player_id, r.b2_guest_id),
      ],
      lockedAt: r.locked_at,
      voidedAt: r.voided_at,
      supersededByScheduleId: r.superseded_by_schedule_id,
      team1Score: r.team1_score,
      team2Score: r.team2_score,
    }));

    const state: PlannerEventState = {
      eventId: event.id,
      currentRound: event.current_round ?? 1,
      numCourts: event.num_courts ?? 1,
      gamesPerPlayer: event.games_per_player ?? event.num_rounds ?? 3,
      totalRounds: event.num_rounds ?? 1,
      format: event.format ?? "open",
      scheduleVersion: event.schedule_version ?? 0,
      participants,
      schedule: scheduleRows,
    };

    // ---- Run the planner ------------------------------------------------
    const plan = scoreRemainingSchedule(state, {
      action: body.action,
      participantId: body.participantId,
      substituteId: body.substituteId,
      regenMode,
    });

    if (!plan.ok) {
      // Nothing to apply — surface the planner's decision to the client.
      return json({
        ok: false,
        preview: previewOnly,
        code: plan.code,
        message: plan.message,
        retryable: plan.retryable ?? false,
        fairnessTriggers: plan.fairnessTriggers,
        plan,
      }, 200);
    }

    // ---- Build the DB-shaped plan + canonical hash ----------------------
    const dbPlan = {
      ok: true,
      action: plan.action,
      plan_type: plan.planType,
      effective_round: plan.effectiveRound,
      mode_requested: plan.modeRequested,
      mode_applied: plan.modeApplied,
      fairness: plan.fairness,
      fairness_triggers: plan.fairnessTriggers,
      rounds_touched: plan.roundsTouched,
      matches_changed: plan.matchesChanged,
      matches_preserved: plan.matchesPreserved,
      protected_rounds_touched: plan.protectedRoundsTouched,
      protected_matches_touched: plan.protectedMatchesTouched,
      reason: plan.reason,
      plan: translateOps(plan.ops),
    };
    const planHash = await sha256Hex(JSON.stringify(canonicalize(dbPlan)));

    // ---- Invoke the transactional apply RPC -----------------------------
    const { data, error } = await supabase.rpc("rr_manage_participant", {
      p_request_id: requestId,
      p_event_id: body.eventId,
      p_player_id: body.participantId,
      p_action: body.action,
      p_reason: body.reason ?? null,
      p_expected_version: state.scheduleVersion,
      p_regen_mode: regenMode,
      p_preview_only: previewOnly,
      p_substitute: body.substitute ??
        (body.substituteId ? { participant_id: body.substituteId } : null),
      p_active_match_resolution: body.activeMatchResolution ?? null,
      p_plan: dbPlan,
      p_plan_hash: planHash,
    });

    if (error) {
      // Decode the structured DETAIL payload the RPC raises.
      let payload: Record<string, unknown> | null = null;
      const raw = (error as { details?: string; message?: string }).details ??
        (error as { message?: string }).message ?? "";
      try {
        if (typeof raw === "string" && raw.trim().startsWith("{")) payload = JSON.parse(raw);
      } catch { /* not JSON */ }
      return json({
        ok: false,
        code: payload?.code ?? (error as { code?: string }).code ?? "rpc_error",
        message: payload?.message ?? (error as { message?: string }).message ?? "Request failed",
        retryable: payload?.retryable ?? false,
        details: payload,
      }, 200);
    }

    return json({ ok: true, requestId, planHash, response: data }, 200);
  } catch (e) {
    return json({ error: { code: "unhandled", message: e instanceof Error ? e.message : String(e) } }, 500);
  }
});
