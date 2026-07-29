/**
 * Organizer-visibility DB integration scenarios (PULSE Skill Assessment).
 *
 * Exercises the authorization + sanitization boundaries that RLS + the
 * SECURITY DEFINER RPCs enforce (get_player_skill_card / record_skill_review /
 * skill_organizer_reviews), which pure unit tests cannot cover.
 *
 * SKIPPED unless SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
 * are set (see tests/skill_shared/harness.ts + tests/README.md). Point them at
 * a DISPOSABLE staging project — never production. The service role is used
 * only for fixture setup/inspection; every authorization assertion is made
 * through an anon or signed-in client so the real boundary is what's tested.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  readSkillEnv, SkillHarness, anonClient, computeSnapshot, validResponses, type TestUser,
} from "../skill_shared/harness";
import type { ScoringSnapshot } from "@/lib/skill/scoring";

const env = readSkillEnv();
const d = env ? describe : describe.skip;

const NIL = "00000000-0000-0000-0000-000000000000";

interface Row {
  self_assessed_level: number | null;
  self_assessed_band: string | null;
  lower_bound: number | null;
  upper_bound: number | null;
  confidence_score: number | null;
  provisional_status: boolean | null;
  primary_style: string | null;
  secondary_style: string | null;
  preferred_side: string | null;
  handedness: string | null;
  review_recommended: boolean | null;
  latest_review_status: string | null;
  card: (ScoringSnapshot & Record<string, unknown>) | null;
}

async function card(client: TestUser["client"], playerId: string, leagueId: string | null) {
  const { data, error } = await client.rpc(
    "get_player_skill_card" as never,
    { p_player_id: playerId, p_league_id: leagueId } as never,
  );
  const rows = (data ?? []) as unknown as Row[];
  return { error, rows, row: rows[0] ?? null };
}

d("skill organizer visibility (staging integration)", () => {
  let h: SkillHarness;
  let organizerA: TestUser;   // creator/admin of leagueA
  let leagueA: string;
  let playerMain: TestUser;   // member of leagueA, has a completed assessment
  let baseSnapshot: ScoringSnapshot;
  const baseLevel = 3.5;
  const baseConfidence = 68;

  beforeAll(async () => {
    h = new SkillHarness(env!);
    organizerA = await h.createUser("org-a");
    leagueA = await h.createLeague(organizerA.id);
    playerMain = await h.createUser("player-main");
    await h.addMember(leagueA, playerMain.id);

    baseSnapshot = computeSnapshot(validResponses(28, "usually"));
    await h.seedCompleted(playerMain.id, {
      snapshot: baseSnapshot, level: baseLevel, confidence: baseConfidence,
      band: "Established", provisional: true, preferredSide: "right", handedness: "right",
      visibility: "organizers",
    });
  });
  afterAll(async () => { await h?.cleanup(); });

  // 0 — anon rejection (defense in depth) --------------------------------
  it("rejects anonymous callers on both organizer RPCs", async () => {
    const anon = anonClient(env!);
    const r1 = await anon.rpc("get_player_skill_card" as never, { p_player_id: NIL, p_league_id: null } as never);
    expect(r1.error, "anon get_player_skill_card must be rejected").toBeTruthy();
    const r2 = await anon.rpc("record_skill_review" as never,
      { p_player_id: NIL, p_league_id: NIL, p_review_status: "reviewed" } as never);
    expect(r2.error, "anon record_skill_review must be rejected").toBeTruthy();
  });

  // 1 — authorized visibility --------------------------------------------
  it("lets an authorized organizer read a member's skill summary", async () => {
    const { error, row } = await card(organizerA.client, playerMain.id, leagueA);
    expect(error, `authorized organizer read should succeed: ${error?.message}`).toBeFalsy();
    expect(row, "a card row should be returned").toBeTruthy();
    expect(Number(row!.self_assessed_level)).toBeCloseTo(baseLevel, 5);
    expect(row!.confidence_score).toBe(baseConfidence);
    expect(row!.provisional_status).toBe(true);
    expect(row!.preferred_side).toBe("right");
  });

  // 2 — sanitized payload -------------------------------------------------
  it("returns a SANITIZED payload (no raw responses, contradictions, or meta)", async () => {
    const { row } = await card(organizerA.client, playerMain.id, leagueA);
    expect(row?.card, "sanitized snapshot present").toBeTruthy();
    const c = row!.card as Record<string, unknown>;
    // Allowed, coach-facing fields survive.
    expect(c.strengths, "strengths retained").toBeDefined();
    expect(c.developmentPriorities, "development priorities retained").toBeDefined();
    expect(c.domains, "broad-domain scores retained").toBeDefined();
    // Private internals are stripped.
    expect(c.contradictions, "contradiction metadata must be stripped").toBeUndefined();
    expect(c.meta, "internal scoring meta must be stripped").toBeUndefined();

    // And the organizer cannot reach the raw per-question responses.
    const attempt = await h.getAttempt(
      (await h.service.from("skill_assessment_attempts").select("id")
        .eq("player_id", playerMain.id).eq("status", "completed").limit(1).single()).data!.id as string,
    );
    const resp = await organizerA.client.from("skill_assessment_responses")
      .select("item_key").eq("attempt_id", attempt!.id as string);
    expect(resp.data?.length ?? 0, "organizer must not read raw responses").toBe(0);
  });

  // 3 — cross-organization rejection -------------------------------------
  it("rejects an organizer from a different organization/league", async () => {
    const organizerB = await h.createUser("org-b");
    await h.createLeague(organizerB.id); // B owns their own league; player is not in it
    const { error, rows } = await card(organizerB.client, playerMain.id, null);
    expect(error, "cross-org read must be denied").toBeTruthy();
    expect(rows.length).toBe(0);
  });

  // 4 — unrelated-league rejection ---------------------------------------
  it("rejects using an unrelated league's admin rights to reach the player", async () => {
    const organizerC = await h.createUser("org-c");
    const leagueC = await h.createLeague(organizerC.id); // player is NOT a member of leagueC
    const { error } = await card(organizerC.client, playerMain.id, leagueC);
    expect(error, "an unrelated league admin must not access the player").toBeTruthy();
  });

  // 5 — normal-player rejection ------------------------------------------
  it("rejects a normal member calling organizer-only operations", async () => {
    const normal = await h.createUser("normal-member");
    await h.addMember(leagueA, normal.id); // a member, but NOT a league admin
    const { error: readErr } = await card(normal.client, playerMain.id, leagueA);
    expect(readErr, "a normal member must not read another player's card").toBeTruthy();
    const { error: revErr } = await normal.client.rpc("record_skill_review" as never,
      { p_player_id: playerMain.id, p_league_id: leagueA, p_review_status: "reviewed" } as never);
    expect(revErr, "a normal member must not record a review").toBeTruthy();
  });

  // 6 — organizer-review write -------------------------------------------
  it("lets an authorized organizer record an auditable, org-scoped review", async () => {
    const { data, error } = await organizerA.client.rpc("record_skill_review" as never, {
      p_player_id: playerMain.id, p_league_id: leagueA, p_review_status: "appropriate", p_note: "looks right",
    } as never);
    expect(error, `review write should succeed: ${error?.message}`).toBeFalsy();
    expect(data, "returns the new review id").toBeTruthy();

    expect(await h.countReviews(playerMain.id, leagueA)).toBeGreaterThanOrEqual(1);
    const { data: reviews } = await h.service.from("skill_organizer_reviews")
      .select("reviewer_id, review_status, league_id").eq("player_id", playerMain.id).eq("league_id", leagueA);
    expect(reviews?.some((r) => r.reviewer_id === organizerA.id && r.review_status === "appropriate")).toBe(true);

    const { data: audit } = await h.service.from("league_audit_log")
      .select("action, entity_id, new_value").eq("league_id", leagueA).eq("action", "skill.review_recorded");
    expect(audit?.some((a) => a.entity_id === playerMain.id), "an audit row is written").toBe(true);
  });

  // 7 — organizer-review privacy -----------------------------------------
  it("keeps organizer notes private from the player and other organizations", async () => {
    // Ensure at least one review exists (from scenario 6 ordering-independence).
    await organizerA.client.rpc("record_skill_review" as never,
      { p_player_id: playerMain.id, p_league_id: leagueA, p_review_status: "reviewed", p_note: "private note" } as never);

    const asPlayer = await playerMain.client.from("skill_organizer_reviews")
      .select("id").eq("player_id", playerMain.id);
    expect(asPlayer.data?.length ?? 0, "the reviewed player must not read organizer notes").toBe(0);

    const organizerB = await h.createUser("org-b-priv");
    await h.createLeague(organizerB.id);
    const asOther = await organizerB.client.from("skill_organizer_reviews")
      .select("id").eq("player_id", playerMain.id);
    expect(asOther.data?.length ?? 0, "an unrelated organizer must not read the review").toBe(0);

    // The player's own card must not surface the organizer's review status.
    const { row } = await card(playerMain.client, playerMain.id, leagueA);
    expect(row?.latest_review_status, "player must not see latest_review_status").toBeNull();
  });

  // 8 — no global-level mutation -----------------------------------------
  it("never mutates the player's global self-assessed level via a review", async () => {
    const before = await h.getProfile(playerMain.id);
    await organizerA.client.rpc("record_skill_review" as never,
      { p_player_id: playerMain.id, p_league_id: leagueA, p_review_status: "too_low", p_note: "should play up" } as never);
    const after = await h.getProfile(playerMain.id);
    expect(Number(after?.self_assessed_level)).toBe(Number(before?.self_assessed_level));
    expect(after?.self_assessment_confidence).toBe(before?.self_assessment_confidence);
    expect(after?.provisional_status).toBe(before?.provisional_status);
  });

  // 9 — no-assessment state ----------------------------------------------
  it("returns a safe empty result for a member with no completed assessment", async () => {
    const playerEmpty = await h.createUser("player-empty");
    await h.addMember(leagueA, playerEmpty.id);
    // A private in-progress draft must never leak through the organizer card.
    const draftId = await h.seedDraft(playerEmpty.id, validResponses(6));

    const { error, rows, row } = await card(organizerA.client, playerEmpty.id, leagueA);
    expect(error, "no-assessment read should not error").toBeFalsy();
    const empty = rows.length === 0 || (row?.self_assessed_level == null && row?.card == null);
    expect(empty, "must be a safe empty result, not partial data").toBe(true);

    const draftResp = await organizerA.client.from("skill_assessment_responses")
      .select("item_key").eq("attempt_id", draftId);
    expect(draftResp.data?.length ?? 0, "draft responses must never leak to an organizer").toBe(0);
  });

  // 10 — low-confidence / provisional indicators --------------------------
  it("exposes safe review indicators without exposing contradiction details", async () => {
    const playerLow = await h.createUser("player-low");
    await h.addMember(leagueA, playerLow.id);

    // A low-confidence snapshot carrying contradictions + internal meta.
    const base = computeSnapshot(validResponses(28, "usually")) as unknown as Record<string, unknown>;
    const mutated = {
      ...base,
      contradictions: [{ group: "backhand_gap", severity: 2 }],
      meta: { ...(base.meta as Record<string, unknown> | undefined), contradictionSeverity: 2 },
      confidence: { ...(base.confidence as Record<string, unknown> | undefined), total: 45, label: "Low" },
    } as unknown as ScoringSnapshot;
    await h.seedCompleted(playerLow.id, {
      snapshot: mutated, level: 3.2, confidence: 45, band: "Developing", provisional: true, visibility: "organizers",
    });

    const { error, row } = await card(organizerA.client, playerLow.id, leagueA);
    expect(error).toBeFalsy();
    expect(row?.review_recommended, "low confidence should recommend review").toBe(true);
    expect(row?.provisional_status).toBe(true);
    expect(row?.confidence_score).toBe(45);
    const c = row!.card as Record<string, unknown>;
    expect(c.contradictions, "contradiction details must NOT be exposed").toBeUndefined();
    expect(c.meta, "internal meta must NOT be exposed").toBeUndefined();
  });
});
