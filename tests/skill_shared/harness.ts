/**
 * Shared staging-integration harness for the PULSE Skill Assessment suites
 * (tests/skill_security + tests/skill_organizer).
 *
 * SAFETY MODEL
 *   • Runs ONLY when SUPABASE_URL + SUPABASE_ANON_KEY + SUPABASE_SERVICE_ROLE_KEY
 *     are all present; otherwise the suites `describe.skip` and never touch a
 *     database. Point these at a DISPOSABLE staging project, never production.
 *   • The service-role client is used ONLY for controlled fixture setup,
 *     inspection, and teardown. Every SECURITY assertion is made through an
 *     anonymous or a signed-in (authenticated) client, so the tests exercise
 *     the real RLS + grant + SECURITY DEFINER boundaries — they never weaken
 *     them to pass.
 *   • Every run creates unique users / leagues / attempts (random emails +
 *     UUID suffixes) and registers them for cleanup, so runs are isolated and
 *     do not depend on or mutate pre-existing data.
 *
 * The service-role key is read from the environment and never logged.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { QUESTION_BANK_V1 } from "@/lib/skill/questionBank";
import { scoreAssessment, type ScoringSnapshot } from "@/lib/skill/scoring";
import type { ResponseKey } from "@/lib/skill/model";

export interface SkillEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export function readSkillEnv(): SkillEnv | null {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceKey: SUPABASE_SERVICE_ROLE_KEY };
}

export function anonClient(env: SkillEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceClient(env: SkillEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  /** A fresh client already signed in as this user (JWT attached). */
  client: SupabaseClient;
}

/** Active v1 item keys, in stable order (the real, versioned question bank). */
export const ACTIVE_ITEM_KEYS: string[] = QUESTION_BANK_V1
  .filter((it) => it.active && it.version === 1)
  .map((it) => it.itemKey);

/** N valid responses (default well above MIN_RESPONSES_TO_COMPLETE=20). */
export function validResponses(count = 28, key: ResponseKey = "usually"): Record<string, ResponseKey> {
  const out: Record<string, ResponseKey> = {};
  for (const k of ACTIVE_ITEM_KEYS.slice(0, count)) out[k] = key;
  return out;
}

/** Every active item answered at maximum mastery (for the 4.7-cap test). */
export function maxResponses(): Record<string, ResponseKey> {
  const out: Record<string, ResponseKey> = {};
  for (const k of ACTIVE_ITEM_KEYS) out[k] = "reliably";
  return out;
}

/** A deterministic real snapshot, computed with the shared engine. */
export function computeSnapshot(responses: Record<string, ResponseKey>): ScoringSnapshot {
  const active = QUESTION_BANK_V1.filter((it) => it.active && it.version === 1);
  return scoreAssessment(active, responses);
}

/** Result of an edge-function invoke, normalized so tests can assert on the body. */
export interface InvokeResult {
  ok: boolean;
  status: number | null;
  body: { error?: string; message?: string; authoritative?: boolean; idempotent?: boolean; snapshot?: ScoringSnapshot } | null;
}

/**
 * Invoke skill-complete with a specific (usually authenticated) client and
 * normalize success + HTTP-error bodies into one shape. Never throws.
 */
export async function invokeComplete(
  client: SupabaseClient,
  body: { attemptId?: string; finalResponses?: Record<string, string> },
): Promise<InvokeResult> {
  const { data, error } = await client.functions.invoke("skill-complete", { body });
  if (!error) return { ok: true, status: 200, body: data ?? null };
  // supabase-js wraps non-2xx in a FunctionsHttpError carrying the Response.
  const ctx = (error as { context?: Response }).context;
  let parsed: InvokeResult["body"] = null;
  let status: number | null = null;
  try {
    if (ctx) { status = ctx.status; parsed = await ctx.json(); }
  } catch { /* body was not JSON */ }
  return { ok: false, status, body: parsed };
}

/**
 * Fixture manager. Tracks everything created so afterAll() can tear it down in
 * FK-safe order (leagues first — their CASCADE removes members/reviews/audit —
 * then users, whose CASCADE removes profiles/attempts/responses/scores/evidence).
 */
export class SkillHarness {
  readonly env: SkillEnv;
  readonly service: SupabaseClient;
  private userIds: string[] = [];
  private leagueIds: string[] = [];

  constructor(env: SkillEnv) {
    this.env = env;
    this.service = serviceClient(env);
  }

  /** Create a confirmed auth user (→ profiles row via handle_new_user) + a signed-in client. */
  async createUser(label: string): Promise<TestUser> {
    const email = `pulse-skilltest+${label}-${randomUUID()}@example.com`;
    const password = `Pw-${randomUUID()}`;
    const { data, error } = await this.service.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error || !data?.user) throw new Error(`fixture: createUser(${label}) failed: ${error?.message}`);
    const id = data.user.id;
    this.userIds.push(id);

    const client = anonClient(this.env);
    const { error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr) throw new Error(`fixture: sign-in(${label}) failed: ${signErr.message}`);
    return { id, email, password, client };
  }

  /** Create a league owned by `createdBy` (→ is_league_admin true for them). */
  async createLeague(createdBy: string, name = `SkillTest League ${randomUUID().slice(0, 8)}`): Promise<string> {
    const { data, error } = await this.service
      .from("leagues")
      .insert({ name, created_by: createdBy, status: "active", league_type: "doubles" })
      .select("id").single();
    if (error || !data) throw new Error(`fixture: createLeague failed: ${error?.message}`);
    this.leagueIds.push(data.id);
    return data.id;
  }

  /** Add `userId` as an active member of `leagueId`. */
  async addMember(leagueId: string, userId: string): Promise<void> {
    const { error } = await this.service
      .from("league_members")
      .insert({ league_id: leagueId, user_id: userId, status: "active", role: "player" });
    if (error) throw new Error(`fixture: addMember failed: ${error.message}`);
  }

  /** Seed an in_progress draft with `responses` persisted. Returns the attempt id. */
  async seedDraft(playerId: string, responses: Record<string, ResponseKey>): Promise<string> {
    const { data, error } = await this.service
      .from("skill_assessment_attempts")
      .insert({ player_id: playerId, assessment_version: 1, assessment_type: "full", status: "in_progress" })
      .select("id").single();
    if (error || !data) throw new Error(`fixture: seedDraft failed: ${error?.message}`);
    await this.seedResponses(data.id, responses);
    return data.id;
  }

  /** Upsert responses onto an attempt (service role; response_value is internal). */
  async seedResponses(attemptId: string, responses: Record<string, string>): Promise<void> {
    const rows = Object.entries(responses).map(([item_key, response_key]) => ({
      attempt_id: attemptId, item_key, response_key, was_skipped: false,
    }));
    if (!rows.length) return;
    const { error } = await this.service
      .from("skill_assessment_responses").upsert(rows, { onConflict: "attempt_id,item_key" });
    if (error) throw new Error(`fixture: seedResponses failed: ${error.message}`);
  }

  /**
   * Seed a COMPLETED assessment directly (fixture setup only — the security
   * suite exercises the real edge-function completion path instead). Writes a
   * completed attempt + the player_skill_profiles summary from a snapshot.
   */
  async seedCompleted(
    playerId: string,
    opts: {
      snapshot: ScoringSnapshot;
      level: number;
      confidence: number;
      band?: string;
      provisional?: boolean;
      preferredSide?: string | null;
      handedness?: string | null;
      visibility?: "private" | "organizers" | "public";
    },
  ): Promise<string> {
    const band = opts.band ?? opts.snapshot.displayBand ?? "Developing";
    const { data, error } = await this.service
      .from("skill_assessment_attempts")
      .insert({
        player_id: playerId, assessment_version: 1, assessment_type: "full", status: "completed",
        completed_at: new Date().toISOString(),
        scoring_model_version: 1,
        estimated_level_raw: opts.level,
        estimated_level_display: opts.snapshot.estimatedLevelDisplay,
        display_band: band,
        lower_bound: opts.snapshot.lowerBound,
        upper_bound: opts.snapshot.upperBound,
        confidence_score: opts.confidence,
        confidence_label: opts.snapshot.confidence?.label ?? null,
        primary_style: opts.snapshot.primaryStyle?.label ?? null,
        secondary_style: opts.snapshot.secondaryStyle?.label ?? null,
        scoring_snapshot: opts.snapshot,
      })
      .select("id").single();
    if (error || !data) throw new Error(`fixture: seedCompleted attempt failed: ${error?.message}`);

    const { error: pErr } = await this.service
      .from("player_skill_profiles")
      .upsert({
        player_id: playerId,
        self_assessed_level: opts.level,
        self_assessed_band: band,
        self_assessed_at: new Date().toISOString(),
        self_assessment_confidence: opts.confidence,
        provisional_status: opts.provisional ?? true,
        preferred_side: opts.preferredSide ?? "either",
        handedness: opts.handedness ?? null,
        visibility: opts.visibility ?? "organizers",
      }, { onConflict: "player_id" });
    if (pErr) throw new Error(`fixture: seedCompleted profile failed: ${pErr.message}`);
    return data.id;
  }

  /** Ensure a (visible) profile row exists WITHOUT any completed assessment. */
  async seedEmptyProfile(playerId: string, visibility: "private" | "organizers" | "public" = "organizers"): Promise<void> {
    const { error } = await this.service
      .from("player_skill_profiles")
      .upsert({ player_id: playerId, visibility, provisional_status: true }, { onConflict: "player_id" });
    if (error) throw new Error(`fixture: seedEmptyProfile failed: ${error.message}`);
  }

  // ---- service-role inspection helpers (setup/verification, never assertions of security) ----

  async getAttempt(attemptId: string) {
    const { data } = await this.service
      .from("skill_assessment_attempts").select("*").eq("id", attemptId).maybeSingle();
    return data as Record<string, unknown> | null;
  }
  async getProfile(playerId: string) {
    const { data } = await this.service
      .from("player_skill_profiles").select("*").eq("player_id", playerId).maybeSingle();
    return data as Record<string, unknown> | null;
  }
  async countScores(attemptId: string): Promise<number> {
    const { count } = await this.service
      .from("player_skill_scores").select("id", { count: "exact", head: true }).eq("attempt_id", attemptId);
    return count ?? 0;
  }
  async countEvidence(attemptId: string): Promise<number> {
    const { count } = await this.service
      .from("skill_evidence").select("id", { count: "exact", head: true })
      .eq("source_id", attemptId).eq("evidence_type", "self_assessment");
    return count ?? 0;
  }
  async countReviews(playerId: string, leagueId: string): Promise<number> {
    const { count } = await this.service
      .from("skill_organizer_reviews").select("id", { count: "exact", head: true })
      .eq("player_id", playerId).eq("league_id", leagueId);
    return count ?? 0;
  }

  /** FK-safe teardown. Best-effort: logs (never throws) so one failure can't mask others. */
  async cleanup(): Promise<void> {
    for (const id of this.leagueIds) {
      const { error } = await this.service.from("leagues").delete().eq("id", id);
      if (error) console.warn(`cleanup: league ${id}: ${error.message}`);
    }
    for (const id of this.userIds) {
      const { error } = await this.service.auth.admin.deleteUser(id);
      if (error) console.warn(`cleanup: user ${id}: ${error.message}`);
    }
    this.leagueIds = [];
    this.userIds = [];
  }
}
