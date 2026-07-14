/**
 * Slice 2a scenarios — scaffold.
 *
 * The suite auto-skips when env vars are missing so it never runs against the
 * wrong project. Slice 3 (Claude Code) is expected to:
 *   1. Wire real fixtures (event id + participants) and remove the it.todo
 *      markers as scenarios are implemented.
 *   2. Add `vitest` + `@supabase/supabase-js` as devDeps and a `test` script.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  assertNoWrites,
  callRpc,
  newRequestId,
  readEnv,
  signedInClient,
  snapshotEvent,
  type HarnessEnv,
} from "./harness";
import type { SupabaseClient } from "@supabase/supabase-js";

const env = readEnv();
const d = env ? describe : describe.skip;

d("rr_manage_participant — Slice 2a contract", () => {
  let client: SupabaseClient;
  let eventId: string;
  let participants: string[];

  beforeAll(async () => {
    const e = env as HarnessEnv;
    client = await signedInClient(e);
    participants = e.participantIds;
    // Slice 3: seed a disposable event and set eventId. Left unimplemented
    // so this scaffold cannot silently mutate a real event.
    eventId = process.env.TEST_EVENT_ID ?? "";
    if (!eventId) throw new Error("TEST_EVENT_ID required to run scenarios");
  });

  it("rejects unauthenticated callers", async () => {
    // Uses a fresh anonymous client (no sign-in).
    const anon = (await import("@supabase/supabase-js")).createClient(
      (env as HarnessEnv).url,
      (env as HarnessEnv).anonKey,
      { auth: { persistSession: false } },
    );
    const { error } = await callRpc(anon, {
      p_request_id: newRequestId(),
      p_event_id: eventId,
      p_player_id: participants[0],
      p_action: "withdraw",
    });
    expect(error?.message).toMatch(/not_authenticated/);
  });

  it("rejects unknown action", async () => {
    const { error } = await callRpc(client, {
      p_request_id: newRequestId(),
      p_event_id: eventId,
      p_player_id: participants[0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_action: "bogus" as any,
    });
    expect(error?.message).toMatch(/invalid_action/);
  });

  it("preview_only performs zero persistent writes", async () => {
    const before = await snapshotEvent(client, eventId);
    const { data, error } = await callRpc(client, {
      p_request_id: newRequestId(),
      p_event_id: eventId,
      p_player_id: participants[0],
      p_action: "withdraw",
      p_preview_only: true,
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    const after = await snapshotEvent(client, eventId);
    assertNoWrites(before, after);
  });

  it("replays completed request byte-for-byte", async () => {
    const rid = newRequestId();
    const args = {
      p_request_id: rid,
      p_event_id: eventId,
      p_player_id: participants[1],
      p_action: "withdraw" as const,
      p_reason: "idempotency replay",
    };
    const first = await callRpc(client, args);
    expect(first.error).toBeNull();
    const second = await callRpc(client, args);
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);
  });

  it("raises idempotency_conflict on request-id reuse with different inputs", async () => {
    const rid = newRequestId();
    await callRpc(client, {
      p_request_id: rid,
      p_event_id: eventId,
      p_player_id: participants[2],
      p_action: "withdraw",
    });
    const { error } = await callRpc(client, {
      p_request_id: rid,
      p_event_id: eventId,
      p_player_id: participants[2],
      p_action: "injure",
    });
    expect(error?.message).toMatch(/idempotency_conflict/);
  });

  it("raises stale_version when p_expected_version is behind", async () => {
    const { error } = await callRpc(client, {
      p_request_id: newRequestId(),
      p_event_id: eventId,
      p_player_id: participants[3],
      p_action: "withdraw",
      p_expected_version: -1,
    });
    expect(error?.message).toMatch(/stale_version/);
  });

  // --- Scenarios below require additional fixture work in Slice 3. ---
  it.todo("active-match: finish_and_record supersedes without clearing history");
  it.todo("active-match: abandon marks abandoned, keeps historical row intact");
  it.todo("active-match: restart_with_substitute creates supersede chain");
  it.todo("replace with duplicate identity raises duplicate_participant_identity");
  it.todo("guest substitute with invalid gender is rejected");
  it.todo("guest substitute flips rating_eligible=false and audits the change");
  it.todo("restore with active replacement raises restore_replacement_conflict");
  it.todo("restore with no future rounds returns no_future_rounds success");
  it.todo("regen_mode=reoptimize returns reoptimization_required without writes");
  it.todo("round_robin_schedule_counted excludes voided/superseded/abandoned rows");
});
