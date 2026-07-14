/**
 * Slice 2a integration-test harness.
 *
 * Scaffold that talks to a REAL Supabase instance (local `supabase start` or a
 * disposable project) — never production. Fails closed: if env vars are
 * missing the suite is skipped rather than run against the wrong database.
 *
 * Fixes over the original scaffold (schema bugs that would have made
 * assertNoWrites misfire):
 *   - version lives on `round_robin_events.schedule_version` (NOT `version`).
 *   - rating eligibility is EVENT-level (`round_robin_events.rating_eligible`);
 *     `round_robin_players` has no `rating_eligible` column.
 *
 * Adds a deterministic fixture seeder (service-role) so scenarios have a fresh
 * disposable event + roster + round-1 schedule to mutate.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export interface HarnessEnv {
  url: string;
  anonKey: string;
  /** The single administrative key (service-role JWT or newer secret key). */
  adminKey: string | null;
  organizerEmail: string;
  organizerPassword: string;
  /** Pre-seeded event id — when set, the seeder is skipped. */
  fixedEventId: string | null;
  fixedParticipantIds: string[] | null;
}

/**
 * Redact anything key-shaped from a string before it is surfaced in a report,
 * error, or log. Covers Supabase legacy JWTs (eyJ…), the newer sb_secret_ /
 * sb_publishable_ keys, and long opaque tokens.
 */
export function redact(input: string): string {
  return (input ?? "")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "eyJ***REDACTED***")
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "sb_$1_***REDACTED***")
    .replace(/postgres(ql)?:\/\/[^@\s]+@/g, "postgres$1://***REDACTED***@")
    .replace(/[A-Za-z0-9_-]{40,}/g, "***REDACTED***");
}

export function readEnv(): HarnessEnv | null {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY,
    TEST_ORGANIZER_EMAIL,
    TEST_ORGANIZER_PASSWORD,
    TEST_EVENT_ID,
    TEST_PARTICIPANT_IDS,
  } = process.env;

  // Exactly one administrative key. Support the legacy service-role JWT and the
  // newer secret-key format; refuse if BOTH are set so there's no ambiguity
  // about which privileged credential is in use.
  if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_SECRET_KEY) {
    throw new Error(
      "Set only ONE admin key: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY, not both.",
    );
  }
  const adminKey = SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_SECRET_KEY ?? null;

  // Minimum needed to run at all: a target + anon key + an organizer login.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_ORGANIZER_EMAIL || !TEST_ORGANIZER_PASSWORD) {
    return null;
  }
  // Either an admin key (to seed) OR an explicit pre-seeded event is required.
  if (!adminKey && !TEST_EVENT_ID) {
    return null;
  }
  // Defense in depth (the setup.env.ts allowlist guard is the primary gate).
  if (SUPABASE_URL.includes("ryxklkayezjnwwunuphn")) {
    throw new Error("Refusing to run integration tests against the production project.");
  }

  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    adminKey,
    organizerEmail: TEST_ORGANIZER_EMAIL,
    organizerPassword: TEST_ORGANIZER_PASSWORD,
    fixedEventId: TEST_EVENT_ID ?? null,
    fixedParticipantIds: TEST_PARTICIPANT_IDS
      ? TEST_PARTICIPANT_IDS.split(",").map((s) => s.trim())
      : null,
  };
}

export const newRequestId = () => randomUUID();

export function anonClient(env: HarnessEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(env: HarnessEnv): SupabaseClient {
  if (!env.adminKey) throw new Error("admin key required for admin client");
  return createClient(env.url, env.adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function signedInClient(env: HarnessEnv): Promise<{ client: SupabaseClient; userId: string }> {
  const client = anonClient(env);
  const { data, error } = await client.auth.signInWithPassword({
    email: env.organizerEmail,
    password: env.organizerPassword,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return { client, userId: data.user!.id };
}

/* ------------------------------------------------------------------ *
 * RPC contract
 * ------------------------------------------------------------------ */

export type RrAction = "withdraw" | "injure" | "remove" | "replace" | "restore";
export type RrResolutionKind = "finish_and_record" | "restart_with_substitute" | "abandon";

export interface RpcArgs {
  p_request_id: string;
  p_event_id: string;
  p_player_id: string;
  p_action: RrAction;
  p_reason?: string | null;
  p_expected_version?: number | null;
  p_regen_mode?: "minimal" | "reoptimize" | "auto";
  p_preview_only?: boolean;
  p_substitute?: unknown;
  p_active_match_resolution?: { kind: RrResolutionKind } | unknown;
}

export async function callRpc(client: SupabaseClient, args: RpcArgs) {
  return client.rpc("rr_manage_participant", args as never);
}

/**
 * Structured error extraction. The RPC raises with a JSON `DETAIL` envelope
 * (`{code, retryable, ...}`); supabase-js surfaces it on `error.details` (or
 * sometimes `error.message`). Tests must switch on `code`, never prose.
 */
export function errorCode(error: { message?: string; details?: string | null } | null): string | null {
  if (!error) return null;
  const raw = error.details ?? error.message ?? "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === "string") return parsed.code;
  } catch {
    /* not JSON — fall through to substring scan */
  }
  return raw || null;
}

/* ------------------------------------------------------------------ *
 * Event snapshot (used by assertNoWrites for the preview read-only proof)
 * ------------------------------------------------------------------ */

export interface EventSnapshot {
  scheduleVersion: number;
  scheduleRowIds: string[];
  auditIds: string[];
  ledgerIds: string[];
  ratingEligible: boolean | null;
  participantStatuses: Record<string, string>;
}

export async function snapshotEvent(client: SupabaseClient, eventId: string): Promise<EventSnapshot> {
  const [{ data: ev }, { data: sched }, { data: audit }, { data: ledger }, { data: players }] =
    await Promise.all([
      client.from("round_robin_events").select("schedule_version, rating_eligible").eq("id", eventId).single(),
      client.from("round_robin_schedule").select("id").eq("event_id", eventId),
      client.from("round_robin_audit").select("id").eq("event_id", eventId),
      client.from("rr_participant_mutation_requests").select("request_id").eq("event_id", eventId),
      client.from("round_robin_players").select("id, status").eq("event_id", eventId),
    ]);
  const evRow = ev as { schedule_version: number; rating_eligible: boolean } | null;
  return {
    scheduleVersion: evRow?.schedule_version ?? -1,
    ratingEligible: evRow?.rating_eligible ?? null,
    scheduleRowIds: (sched ?? []).map((r: { id: string }) => r.id).sort(),
    auditIds: (audit ?? []).map((r: { id: string }) => r.id).sort(),
    ledgerIds: (ledger ?? []).map((r: { request_id: string }) => r.request_id).sort(),
    participantStatuses: Object.fromEntries(
      (players ?? []).map((p: { id: string; status: string }) => [p.id, p.status]),
    ),
  };
}

export function assertNoWrites(before: EventSnapshot, after: EventSnapshot): void {
  const diffs: string[] = [];
  if (before.scheduleVersion !== after.scheduleVersion)
    diffs.push(`schedule_version ${before.scheduleVersion} -> ${after.scheduleVersion}`);
  if (JSON.stringify(before.scheduleRowIds) !== JSON.stringify(after.scheduleRowIds))
    diffs.push("schedule row set changed");
  if (JSON.stringify(before.auditIds) !== JSON.stringify(after.auditIds))
    diffs.push("audit row set changed");
  if (JSON.stringify(before.ledgerIds) !== JSON.stringify(after.ledgerIds))
    diffs.push("ledger row set changed");
  if (before.ratingEligible !== after.ratingEligible)
    diffs.push(`rating_eligible ${before.ratingEligible} -> ${after.ratingEligible}`);
  if (JSON.stringify(before.participantStatuses) !== JSON.stringify(after.participantStatuses))
    diffs.push("participant statuses changed");
  if (diffs.length) throw new Error(`expected no writes, but: ${diffs.join("; ")}`);
}
