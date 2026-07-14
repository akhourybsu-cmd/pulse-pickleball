/**
 * Slice 2a integration-test harness.
 *
 * This is a scaffold. It intentionally does NOT execute against production.
 * It reads a disposable project's credentials from environment variables and
 * fails fast if they are missing so the suite is skipped rather than run
 * against the wrong database.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export interface HarnessEnv {
  url: string;
  anonKey: string;
  organizerEmail: string;
  organizerPassword: string;
  participantIds: string[];
}

export function readEnv(): HarnessEnv | null {
  const {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    TEST_ORGANIZER_EMAIL,
    TEST_ORGANIZER_PASSWORD,
    TEST_PARTICIPANT_IDS,
  } = process.env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !TEST_ORGANIZER_EMAIL ||
    !TEST_ORGANIZER_PASSWORD ||
    !TEST_PARTICIPANT_IDS
  ) {
    return null;
  }
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    organizerEmail: TEST_ORGANIZER_EMAIL,
    organizerPassword: TEST_ORGANIZER_PASSWORD,
    participantIds: TEST_PARTICIPANT_IDS.split(",").map((s) => s.trim()),
  };
}

export async function signedInClient(env: HarnessEnv): Promise<SupabaseClient> {
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: env.organizerEmail,
    password: env.organizerPassword,
  });
  if (error) throw new Error(`sign-in failed: ${error.message}`);
  return client;
}

export const newRequestId = () => randomUUID();

export interface RpcArgs {
  p_request_id: string;
  p_event_id: string;
  p_player_id: string;
  p_action: "withdraw" | "injure" | "remove" | "replace" | "restore";
  p_reason?: string | null;
  p_expected_version?: number | null;
  p_regen_mode?: "minimal" | "reoptimize" | "auto";
  p_preview_only?: boolean;
  p_substitute?: unknown;
  p_active_match_resolution?: unknown;
}

export async function callRpc(client: SupabaseClient, args: RpcArgs) {
  return client.rpc("rr_manage_participant", args as never);
}

export interface EventSnapshot {
  version: number;
  scheduleRowIds: string[];
  auditIds: string[];
  ledgerIds: string[];
  ratingEligible: Record<string, boolean>;
}

export async function snapshotEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<EventSnapshot> {
  const [{ data: ev }, { data: sched }, { data: audit }, { data: ledger }, { data: players }] =
    await Promise.all([
      client.from("round_robin_events").select("version").eq("id", eventId).single(),
      client.from("round_robin_schedule").select("id").eq("event_id", eventId),
      client.from("round_robin_audit").select("id").eq("event_id", eventId),
      client
        .from("rr_participant_mutation_requests")
        .select("request_id")
        .eq("event_id", eventId),
      client
        .from("round_robin_players")
        .select("player_id, rating_eligible")
        .eq("event_id", eventId),
    ]);
  return {
    version: (ev as { version: number } | null)?.version ?? -1,
    scheduleRowIds: (sched ?? []).map((r: { id: string }) => r.id).sort(),
    auditIds: (audit ?? []).map((r: { id: string }) => r.id).sort(),
    ledgerIds: (ledger ?? []).map((r: { request_id: string }) => r.request_id).sort(),
    ratingEligible: Object.fromEntries(
      (players ?? []).map((p: { player_id: string; rating_eligible: boolean }) => [
        p.player_id,
        p.rating_eligible,
      ]),
    ),
  };
}

export function assertNoWrites(before: EventSnapshot, after: EventSnapshot) {
  const diffs: string[] = [];
  if (before.version !== after.version) diffs.push(`version ${before.version} -> ${after.version}`);
  if (JSON.stringify(before.scheduleRowIds) !== JSON.stringify(after.scheduleRowIds))
    diffs.push("schedule row set changed");
  if (JSON.stringify(before.auditIds) !== JSON.stringify(after.auditIds))
    diffs.push("audit row set changed");
  if (JSON.stringify(before.ledgerIds) !== JSON.stringify(after.ledgerIds))
    diffs.push("ledger row set changed");
  if (JSON.stringify(before.ratingEligible) !== JSON.stringify(after.ratingEligible))
    diffs.push("rating_eligible changed");
  if (diffs.length) throw new Error(`expected no writes, but: ${diffs.join("; ")}`);
}
