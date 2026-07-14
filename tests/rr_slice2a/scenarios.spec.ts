/**
 * Slice 2a behavioral contract — exercises `rr_manage_participant` end-to-end
 * against a real Supabase instance (local `supabase start` recommended).
 *
 * Isolation: every mutating test seeds a FRESH disposable event (beforeEach)
 * and tears it down (afterEach), so tests never contaminate each other's
 * roster/schedule/version. Requires a service role (to seed). Without it the
 * whole suite auto-skips — we do not run a degraded subset that could give a
 * false sense of coverage.
 *
 * Tests switch on the structured `code` (harness.errorCode), never on prose.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  anonClient,
  callRpc,
  errorCode,
  newRequestId,
  readEnv,
  signedInClient,
  snapshotEvent,
  assertNoWrites,
  type HarnessEnv,
} from "./harness";
import { seedEvent, teardownEvent, type SeededEvent } from "./fixtures";

const env = readEnv();
const canSeed = !!env?.adminKey;
// Full behavioral coverage needs seeding. Skip loudly rather than run partial.
const d = env && canSeed ? describe : describe.skip;

let organizer: SupabaseClient;
let organizerId: string;
let admin: SupabaseClient;
let seeded: SeededEvent;
let seedTag = 0;

d("rr_manage_participant — Slice 2a behavioral contract", () => {
  beforeAll(async () => {
    const e = env as HarnessEnv;
    admin = adminClient(e);
    const s = await signedInClient(e);
    organizer = s.client;
    organizerId = s.userId;
  });

  beforeEach(async () => {
    seedTag += 1;
    seeded = await seedEvent(admin, organizerId, `t${seedTag}`);
  });

  afterEach(async () => {
    if (seeded) await teardownEvent(admin, seeded);
  });

  const base = () => ({ p_request_id: newRequestId(), p_event_id: seeded.eventId });

  /* --- Auth + input validation --- */

  it("rejects unauthenticated callers", async () => {
    const anon = anonClient(env as HarnessEnv);
    const { error } = await callRpc(anon, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
    });
    expect(errorCode(error)).toBe("not_authenticated");
  });

  it("rejects unknown action", async () => {
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "bogus" as never,
    });
    expect(errorCode(error)).toBe("invalid_action");
  });

  it("rejects non-organizer callers (not_authorized)", async () => {
    // Sign in as a non-organizer participant.
    const e = env as HarnessEnv;
    const outsider = anonClient(e);
    await outsider.auth.signInWithPassword({
      email: `rr-p1-t${seedTag}@example.test`,
      password: `rr-pw-t${seedTag}-1`,
    });
    const { error } = await callRpc(outsider, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_preview_only: true,
    });
    expect(errorCode(error)).toBe("not_authorized");
  });

  /* --- Preview read-only proof --- */

  it("preview_only performs zero persistent writes", async () => {
    const before = await snapshotEvent(admin, seeded.eventId);
    const { data, error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_preview_only: true,
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(error).toBeNull();
    expect((data as { preview: boolean }).preview).toBe(true);
    const after = await snapshotEvent(admin, seeded.eventId);
    assertNoWrites(before, after); // version, schedule, audit, ledger, rating, statuses
  });

  /* --- Participant state transitions --- */

  it("withdraw active → withdrawn (with abandon resolution) bumps version + audits", async () => {
    const before = await snapshotEvent(admin, seeded.eventId);
    const { data, error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_reason: "test withdraw",
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(error).toBeNull();
    const after = await snapshotEvent(admin, seeded.eventId);
    expect(after.scheduleVersion).toBe(before.scheduleVersion + 1);
    expect(after.participantStatuses[seeded.matchPlayerIds[0]]).toBe("withdrawn");
    expect(after.auditIds.length).toBeGreaterThan(before.auditIds.length);
    expect((data as { schedule_version: number }).schedule_version).toBe(after.scheduleVersion);
  });

  it("injure then restore returns the player to active", async () => {
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "injure",
      p_active_match_resolution: { kind: "abandon" },
    });
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "restore",
    });
    expect(error).toBeNull();
    const after = await snapshotEvent(admin, seeded.eventId);
    expect(after.participantStatuses[seeded.matchPlayerIds[0]]).toBe("active");
  });

  it("restore from removed is rejected (terminal_state)", async () => {
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "remove",
      p_active_match_resolution: { kind: "abandon" },
    });
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "restore",
    });
    expect(errorCode(error)).toBe("invalid_state_transition");
  });

  it("repeated terminal action on an already-withdrawn player is rejected", async () => {
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "abandon" },
    });
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(errorCode(error)).toBe("invalid_state_transition");
  });

  it("participant from another event is rejected (participant_not_found)", async () => {
    const other = await seedEvent(admin, organizerId, `other${seedTag}`);
    try {
      const { error } = await callRpc(organizer, {
        ...base(),
        p_player_id: other.matchPlayerIds[0], // belongs to a different event
        p_action: "withdraw",
        p_preview_only: true,
      });
      expect(errorCode(error)).toBe("participant_not_found");
    } finally {
      await teardownEvent(admin, other);
    }
  });

  /* --- Active-match resolution --- */

  it("withdraw with an active match and no resolution → active_match_resolution_required", async () => {
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
    });
    expect(errorCode(error)).toBe("active_match_resolution_required");
  });

  it("finish_and_record requires a final score (final_score_required)", async () => {
    // Seeded round-1 match has null scores.
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "finish_and_record" },
    });
    expect(errorCode(error)).toBe("final_score_required");
  });

  it("abandon marks the schedule row abandoned + voided, keeps the row (history intact)", async () => {
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "abandon" },
    });
    const { data: row } = await admin
      .from("round_robin_schedule")
      .select("abandoned, voided_at")
      .eq("id", seeded.scheduleRowId)
      .single();
    expect((row as { abandoned: boolean }).abandoned).toBe(true);
    expect((row as { voided_at: string | null }).voided_at).not.toBeNull();
  });

  it("restart_with_substitute creates a supersede chain without deleting the original", async () => {
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "restart_with_substitute" },
      p_substitute: { participant_id: seeded.substituteId },
    });
    expect(error).toBeNull();
    const { data: original } = await admin
      .from("round_robin_schedule")
      .select("superseded_by_schedule_id, abandoned")
      .eq("id", seeded.scheduleRowId)
      .single();
    expect((original as { superseded_by_schedule_id: string | null }).superseded_by_schedule_id).not.toBeNull();
    // Exactly one active successor at that slot (enforced by uq_rr_schedule_active_slot).
    const { data: active } = await admin
      .from("round_robin_schedule")
      .select("id")
      .eq("event_id", seeded.eventId)
      .eq("round_no", 1)
      .eq("court_no", 1)
      .is("voided_at", null)
      .is("superseded_by_schedule_id", null);
    expect((active ?? []).length).toBe(1);
  });

  /* --- Replace + duplicate identity + guests --- */

  it("replace with a duplicate registered identity raises duplicate_participant_identity", async () => {
    // Use an already-seated player id as the substitute → duplicate identity.
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "replace",
      p_substitute: { participant_id: seeded.matchPlayerIds[1] },
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(errorCode(error)).toBe("duplicate_participant_identity");
  });

  it("self-substitution is rejected (substitute_invalid)", async () => {
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "replace",
      p_substitute: { participant_id: seeded.matchPlayerIds[0] },
    });
    expect(errorCode(error)).toBe("substitute_invalid");
  });

  it("guest substitute with invalid gender is rejected (guest_gender_invalid)", async () => {
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "replace",
      p_substitute: {
        participant_id: seeded.substituteId,
        guest: { display_name: "Guesty", gender: "not-a-gender" },
      },
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(errorCode(error)).toBe("guest_gender_invalid");
  });

  it("guest substitute flips event rating_eligible=false and audits the change", async () => {
    const before = await snapshotEvent(admin, seeded.eventId);
    expect(before.ratingEligible).toBe(true);
    const { data, error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "replace",
      p_substitute: {
        participant_id: seeded.substituteId,
        guest: { display_name: `Guest ${seedTag}`, gender: "other" },
      },
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(error).toBeNull();
    const after = await snapshotEvent(admin, seeded.eventId);
    expect(after.ratingEligible).toBe(false);
    expect((data as { rating_eligibility_change: { before: boolean; after: boolean } }).rating_eligibility_change)
      .toEqual({ before: true, after: false });
    // Restoration must never flip eligibility back to true.
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "restore",
    });
    const restored = await snapshotEvent(admin, seeded.eventId);
    expect(restored.ratingEligible).toBe(false);
  });

  /* --- Restore safeguards --- */

  it("restore blocked by an active replacement raises restore_replacement_conflict", async () => {
    // Replace player0 with the spare substitute (spare becomes active).
    await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "replace",
      p_substitute: { participant_id: seeded.substituteId },
      p_active_match_resolution: { kind: "abandon" },
    });
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "restore",
    });
    expect(errorCode(error)).toBe("restore_replacement_conflict");
  });

  /* --- Idempotency, concurrency --- */

  it("replays a completed request byte-for-byte without a second mutation", async () => {
    const rid = newRequestId();
    const args = {
      p_request_id: rid,
      p_event_id: seeded.eventId,
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw" as const,
      p_active_match_resolution: { kind: "abandon" as const },
    };
    const first = await callRpc(organizer, args);
    expect(first.error).toBeNull();
    const versionAfterFirst = (await snapshotEvent(admin, seeded.eventId)).scheduleVersion;
    const second = await callRpc(organizer, args);
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);
    // Replay must not bump the version again.
    expect((await snapshotEvent(admin, seeded.eventId)).scheduleVersion).toBe(versionAfterFirst);
  });

  it("same request id with different inputs raises idempotency_conflict", async () => {
    const rid = newRequestId();
    await callRpc(organizer, {
      p_request_id: rid,
      p_event_id: seeded.eventId,
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_active_match_resolution: { kind: "abandon" },
    });
    const { error } = await callRpc(organizer, {
      p_request_id: rid,
      p_event_id: seeded.eventId,
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "injure",
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(errorCode(error)).toBe("idempotency_conflict");
  });

  it("stale expected_version is rejected (stale_version) with no write", async () => {
    const before = await snapshotEvent(admin, seeded.eventId);
    const { error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_expected_version: before.scheduleVersion - 100,
      p_active_match_resolution: { kind: "abandon" },
    });
    expect(errorCode(error)).toBe("stale_version");
    assertNoWrites(before, await snapshotEvent(admin, seeded.eventId));
  });

  it("two organizers on the same version: exactly one succeeds, the other is stale_version", async () => {
    const v = (await snapshotEvent(admin, seeded.eventId)).scheduleVersion;
    const mk = (playerIdx: number) =>
      callRpc(organizer, {
        ...base(),
        p_player_id: seeded.matchPlayerIds[playerIdx],
        p_action: "withdraw",
        p_expected_version: v,
        p_active_match_resolution: { kind: "abandon" },
      });
    const [a, b] = await Promise.all([mk(0), mk(1)]);
    const codes = [a, b].map((r) => (r.error ? errorCode(r.error) : "ok"));
    expect(codes.filter((c) => c === "ok")).toHaveLength(1);
    expect(codes.filter((c) => c === "stale_version")).toHaveLength(1);
  });

  /* --- Regen mode escalation (Slice 2a: reoptimize not implemented) --- */

  it("regen_mode=reoptimize returns reoptimization_required without writing", async () => {
    const before = await snapshotEvent(admin, seeded.eventId);
    const { data, error } = await callRpc(organizer, {
      ...base(),
      p_player_id: seeded.matchPlayerIds[0],
      p_action: "withdraw",
      p_regen_mode: "reoptimize",
      p_preview_only: true,
    });
    // Preview returns the plan envelope (ok:false) rather than raising.
    expect(error).toBeNull();
    const plan = (data as { plan: { ok: boolean; code: string } }).plan;
    expect(plan.ok).toBe(false);
    expect(plan.code).toBe("reoptimization_required");
    assertNoWrites(before, await snapshotEvent(admin, seeded.eventId));
  });
});
