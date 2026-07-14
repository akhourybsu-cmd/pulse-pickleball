/**
 * Deterministic fixture seeder for the Slice 2a suite.
 *
 * Builds a disposable round-robin event with a known roster and a single
 * round-1 doubles match, using the service-role client. Everything is torn
 * down after the suite. NEVER run against production (the harness refuses the
 * prod project ref).
 *
 * NOTE (verify on first local run): the exact NOT-NULL/default columns of
 * round_robin_events / round_robin_players / round_robin_schedule and the
 * profile-creation trigger are asserted from the generated types + migrations.
 * If `supabase start` reveals a required column without a default, add it here
 * — this seeder is intentionally minimal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface SeededEvent {
  eventId: string;
  /** Four active roster ids seated in the round-1 court. */
  matchPlayerIds: [string, string, string, string];
  /** A spare active roster id, not seated in round 1 — a valid substitute. */
  substituteId: string;
  scheduleRowId: string;
  /** Auth user ids created for this fixture (for teardown). */
  createdUserIds: string[];
}

/** Create an auth user, or return the existing one's id if already present. */
async function createOrGetUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!error && data.user) return data.user.id;

  // Already registered → find the id by paging listUsers.
  for (let page = 1; page <= 20; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (!list || list.users.length < 200) break;
  }
  throw new Error(`could not create or find user ${email}: ${error?.message ?? "unknown"}`);
}

/** Ensure a profiles row exists (in case the new-user trigger is absent locally). */
async function ensureProfile(admin: SupabaseClient, userId: string, name: string): Promise<void> {
  await admin.from("profiles").upsert({ id: userId, full_name: name }, { onConflict: "id" });
}

export async function seedEvent(
  admin: SupabaseClient,
  organizerId: string,
  tag: string,
): Promise<SeededEvent> {
  // Five participant profiles: 4 seated + 1 spare substitute.
  const createdUserIds: string[] = [];
  const playerIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const uid = await createOrGetUser(admin, `rr-p${i}-${tag}@example.test`, `rr-pw-${tag}-${i}`);
    await ensureProfile(admin, uid, `RR Player ${i} ${tag}`);
    createdUserIds.push(uid);
    playerIds.push(uid);
  }

  // Event owned by the organizer. status omitted → non-'completed' default,
  // which the RPC treats as mutable. rating_eligible left at its default
  // (true) so the guest-substitute flip test can observe true -> false.
  const { data: ev, error: evErr } = await admin
    .from("round_robin_events")
    .insert({
      name: `Slice2a fixture ${tag}`,
      organizer_id: organizerId,
      num_courts: 1,
      num_rounds: 3,
      current_round: 1,
      format: "open",
      allow_guests: true,
    })
    .select("id")
    .single();
  if (evErr || !ev) throw new Error(`seed event failed: ${evErr?.message}`);
  const eventId = ev.id as string;

  // Roster: 5 active players.
  const rosterRows = playerIds.map((pid) => ({ event_id: eventId, player_id: pid, status: "active", active: true }));
  const { data: roster, error: rErr } = await admin
    .from("round_robin_players")
    .insert(rosterRows)
    .select("id, player_id");
  if (rErr || !roster || roster.length !== 5) throw new Error(`seed roster failed: ${rErr?.message}`);

  const rosterByProfile = new Map<string, string>(
    roster.map((r: { id: string; player_id: string }) => [r.player_id, r.id]),
  );
  const matchPlayerIds = playerIds.slice(0, 4).map((p) => rosterByProfile.get(p)!) as [
    string, string, string, string,
  ];
  const substituteId = rosterByProfile.get(playerIds[4])!;

  // Round-1 doubles match: A = profiles 0,1  vs  B = profiles 2,3. No scores yet.
  const { data: sched, error: sErr } = await admin
    .from("round_robin_schedule")
    .insert({
      event_id: eventId,
      round_no: 1,
      court_no: 1,
      is_bye: false,
      a1_player_id: playerIds[0],
      a2_player_id: playerIds[1],
      b1_player_id: playerIds[2],
      b2_player_id: playerIds[3],
    })
    .select("id")
    .single();
  if (sErr || !sched) throw new Error(`seed schedule failed: ${sErr?.message}`);

  return { eventId, matchPlayerIds, substituteId, scheduleRowId: sched.id as string, createdUserIds };
}

export async function teardownEvent(admin: SupabaseClient, seeded: SeededEvent): Promise<void> {
  // Child rows first (FKs may or may not cascade depending on local schema).
  await admin.from("round_robin_schedule").delete().eq("event_id", seeded.eventId);
  await admin.from("round_robin_audit").delete().eq("event_id", seeded.eventId);
  await admin.from("rr_participant_mutation_requests").delete().eq("event_id", seeded.eventId);
  await admin.from("round_robin_players").delete().eq("event_id", seeded.eventId);
  await admin.from("round_robin_events").delete().eq("id", seeded.eventId);
  // Auth users are left in the local stack (cheap, and reused by createOrGetUser
  // across runs). A full `supabase db reset` clears them.
}
