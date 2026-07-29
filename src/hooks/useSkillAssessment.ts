import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  QUESTION_BANK_V1,
} from "@/lib/skill/questionBank";
import {
  ASSESSMENT_VERSION,
  RESPONSE_MASTERY,
  type ResponseKey,
} from "@/lib/skill/model";
import { scoreAssessment, type Responses, type ScoringSnapshot } from "@/lib/skill/scoring";
import {
  selectNextItemKey,
  isComplete,
  DEFAULT_ADAPTIVE_CONFIG,
} from "@/lib/skill/adaptive";

/**
 * Persistence + orchestration for the PULSE Skill Assessment.
 *
 * Owns the attempt lifecycle against Supabase (create/resume a single
 * draft, save each response, finalize via the apply_skill_scoring_snapshot
 * RPC) and derives the next adaptive item + running snapshot from the pure
 * engine. Save-and-resume safe: responses persist per answer, and the
 * unique partial index (one in_progress attempt per player) plus a resume
 * lookup prevent duplicate drafts.
 *
 * The skill tables aren't in the generated Supabase types yet, so reads use
 * `as never` casts — the same pattern the rest of League Play uses.
 */

export interface CompletedAttempt {
  id: string;
  completed_at: string | null;
  assessment_version: number;
  estimated_level_display: number | null;
  display_band: string | null;
  confidence_score: number | null;
  confidence_label: string | null;
  primary_style: string | null;
  secondary_style: string | null;
  scoring_snapshot: ScoringSnapshot | null;
}

export type Phase = "loading" | "intro" | "in_progress" | "finalizing" | "result" | "signed_out";

interface State {
  phase: Phase;
  userId: string | null;
  attemptId: string | null;
  responses: Responses;
  /** Latest completed attempt (drives the result screen + profile summary). */
  latest: CompletedAttempt | null;
  history: CompletedAttempt[];
  saving: boolean;
}

const cfg = DEFAULT_ADAPTIVE_CONFIG;

export function useSkillAssessment() {
  const [state, setState] = useState<State>({
    phase: "loading",
    userId: null,
    attemptId: null,
    responses: {},
    latest: null,
    history: [],
    saving: false,
  });
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState((s) => ({ ...s, phase: "signed_out" }));
      return;
    }
    // Completed history (newest first) + any open draft.
    const [{ data: completed }, { data: draft }] = await Promise.all([
      supabase.from("skill_assessment_attempts" as never)
        .select("*").eq("player_id", user.id).eq("status", "completed")
        .order("completed_at", { ascending: false }),
      supabase.from("skill_assessment_attempts" as never)
        .select("id").eq("player_id", user.id).eq("status", "in_progress")
        .maybeSingle(),
    ]);
    const history = ((completed ?? []) as unknown as CompletedAttempt[]);
    const draftId = (draft as unknown as { id: string } | null)?.id ?? null;

    let responses: Responses = {};
    if (draftId) {
      const { data: rows } = await supabase.from("skill_assessment_responses" as never)
        .select("item_key, response_key").eq("attempt_id", draftId);
      responses = Object.fromEntries(
        ((rows ?? []) as unknown as Array<{ item_key: string; response_key: ResponseKey }>)
          .map((r) => [r.item_key, r.response_key]),
      );
    }

    setState((s) => ({
      ...s,
      userId: user.id,
      attemptId: draftId,
      responses,
      latest: history[0] ?? null,
      history,
      // Resume straight into an open draft; otherwise the intro.
      phase: draftId ? "in_progress" : (history[0] ? "result" : "intro"),
    }));
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Create a fresh draft (or resume the existing one) and enter the wizard. */
  const start = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState((s) => ({ ...s, phase: "signed_out" })); return; }
      // Resume if a draft already exists (the unique index guarantees ≤1).
      const { data: existing } = await supabase.from("skill_assessment_attempts" as never)
        .select("id").eq("player_id", user.id).eq("status", "in_progress").maybeSingle();
      let attemptId = (existing as unknown as { id: string } | null)?.id ?? null;
      if (!attemptId) {
        const { data: created, error } = await supabase.from("skill_assessment_attempts" as never)
          .insert({ player_id: user.id, assessment_version: ASSESSMENT_VERSION, assessment_type: "full", status: "in_progress" } as never)
          .select("id").single();
        if (error) throw error;
        attemptId = (created as unknown as { id: string }).id;
      }
      setState((s) => ({ ...s, attemptId, phase: "in_progress" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the assessment");
    } finally {
      inFlight.current = false;
    }
  }, []);

  /** Persist one answer, then advance. Optimistic + durable. */
  const answer = useCallback(async (itemKey: string, responseKey: ResponseKey) => {
    const attemptId = state.attemptId;
    if (!attemptId) return;
    setState((s) => ({ ...s, responses: { ...s.responses, [itemKey]: responseKey }, saving: true }));
    const value = RESPONSE_MASTERY[responseKey];
    const { error } = await supabase.from("skill_assessment_responses" as never)
      .upsert({
        attempt_id: attemptId,
        item_key: itemKey,
        response_key: responseKey,
        response_value: value,
        was_skipped: false,
      } as never, { onConflict: "attempt_id,item_key" } as never);
    // Keep last-activity fresh for save-and-resume ordering.
    await supabase.from("skill_assessment_attempts" as never)
      .update({ last_activity_at: new Date().toISOString() } as never).eq("id", attemptId);
    setState((s) => ({ ...s, saving: false }));
    if (error) toast.error("That answer didn't save — check your connection and try again.");
  }, [state.attemptId]);

  /** Score locally (pure engine) and finalize via the controlled RPC. */
  const finalize = useCallback(async () => {
    if (!state.attemptId) return;
    setState((s) => ({ ...s, phase: "finalizing" }));
    try {
      const snapshot = scoreAssessment(QUESTION_BANK_V1, state.responses);
      const { error } = await supabase.rpc(
        "apply_skill_scoring_snapshot" as never,
        { p_attempt_id: state.attemptId, p_snapshot: snapshot as unknown } as never,
      );
      if (error) throw error;
      await load();
      setState((s) => ({ ...s, phase: "result" }));
    } catch (e) {
      // Never lose a completed assessment to a failed result request.
      toast.error(e instanceof Error ? `Couldn't save your results: ${e.message}` : "Couldn't save your results");
      setState((s) => ({ ...s, phase: "in_progress" }));
    }
  }, [state.attemptId, state.responses, load]);

  /** Abandon the current draft and begin a new one. */
  const restart = useCallback(async () => {
    if (state.attemptId) {
      await supabase.from("skill_assessment_attempts" as never)
        .delete().eq("id", state.attemptId).eq("status", "in_progress");
    }
    setState((s) => ({ ...s, attemptId: null, responses: {} }));
    await start();
  }, [state.attemptId, start]);

  const showIntro = useCallback(() => setState((s) => ({ ...s, phase: "intro" })), []);
  const showResult = useCallback(() => setState((s) => ({ ...s, phase: "result" })), []);

  // Derived (pure) values for the wizard.
  const nextItemKey = state.phase === "in_progress"
    ? selectNextItemKey(QUESTION_BANK_V1, state.responses, cfg)
    : null;
  const answeredCount = Object.keys(state.responses).length;
  const complete = isComplete(QUESTION_BANK_V1, state.responses, cfg);
  const runningSnapshot = answeredCount > 0 ? scoreAssessment(QUESTION_BANK_V1, state.responses) : null;

  return {
    ...state,
    nextItemKey,
    answeredCount,
    complete,
    runningSnapshot,
    minItems: cfg.minItems,
    maxItems: cfg.maxItems,
    start,
    answer,
    finalize,
    restart,
    showIntro,
    showResult,
    reload: load,
  };
}
