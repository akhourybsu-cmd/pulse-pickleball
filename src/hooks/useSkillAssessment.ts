import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  QUESTION_BANK_V1,
} from "@/lib/skill/questionBank";
import { QUESTION_BANK_V2 } from '@/lib/skill/questionBankV2';
import { ADAPTIVE_CONFIG_V2 } from '@/lib/skill/adaptiveV2';
import {
  ASSESSMENT_VERSION,
  RESPONSE_MASTERY,
  type ResponseKey,
} from "@/lib/skill/model";
import { scoreAssessment, type Responses, type ScoringSnapshot } from "@/lib/skill/scoring";
import { haptic } from "@/lib/haptics";
import { withAuthDeadline } from '@/lib/authDeadline';
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

export type Phase = "loading" | "intro" | "in_progress" | "finalizing" | "result" | "signed_out" | "error";

interface State {
  phase: Phase;
  userId: string | null;
  attemptId: string | null;
  responses: Responses;
  /** Latest completed attempt (drives the result screen + profile summary). */
  latest: CompletedAttempt | null;
  history: CompletedAttempt[];
  saving: boolean;
  starting: boolean;
  assessmentVersion: number;
}


export function useSkillAssessment() {
  const [state, setState] = useState<State>({
    phase: "loading",
    userId: null,
    attemptId: null,
    responses: {},
    latest: null,
    history: [],
    saving: false,
    starting: false,
    assessmentVersion: ASSESSMENT_VERSION,
  });
  const inFlight = useRef(false);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setState(s => ({ ...s, phase: 'loading' }));
    try {
      const loaded = await withAuthDeadline(async signal => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        signal.throwIfAborted();
        if (userError) throw userError;
        if (!user) return null;
        // Completed history (newest first) + any open draft.
        const [{ data: completed, error: completedError }, { data: draft, error: draftError }] = await Promise.all([
          supabase.from("skill_assessment_attempts" as never)
            .select("*").eq("player_id", user.id).eq("status", "completed")
            .order("completed_at", { ascending: false }).abortSignal(signal),
          supabase.from("skill_assessment_attempts" as never)
            .select("id, assessment_version").eq("player_id", user.id).eq("status", "in_progress")
            .abortSignal(signal).maybeSingle(),
        ]);
        if (completedError || draftError) throw completedError || draftError;
        const history = ((completed ?? []) as unknown as CompletedAttempt[]);
        const draftId = (draft as unknown as { id: string } | null)?.id ?? null;
        const assessmentVersion = (draft as unknown as { assessment_version: number } | null)?.assessment_version ?? ASSESSMENT_VERSION;
        if (![1, 2].includes(assessmentVersion)) throw new Error('This assessment version needs a newer app.');

        let responses: Responses = {};
        if (draftId) {
          const { data: rows, error: responsesError } = await supabase.from("skill_assessment_responses" as never)
            .select("item_key, response_key").eq("attempt_id", draftId).abortSignal(signal);
          if (responsesError) throw responsesError;
          responses = Object.fromEntries(
            ((rows ?? []) as unknown as Array<{ item_key: string; response_key: ResponseKey }>)
              .map((r) => [r.item_key, r.response_key]),
          );
        }

        return {
          userId: user.id,
          attemptId: draftId,
          responses,
          latest: history[0] ?? null,
          history,
          assessmentVersion,
          // Resume straight into an open draft; otherwise the intro.
          phase: (draftId ? "in_progress" : (history[0] ? "result" : "intro")) as Phase,
        };
      });
      // Ignore older StrictMode/retry loads and responses after leaving the page.
      if (generation !== loadGeneration.current) return false;
      setState(s => loaded ? { ...s, ...loaded } : {
        ...s, phase: 'signed_out', userId: null, attemptId: null, responses: {}, latest: null, history: [],
      });
      return true;
    } catch {
      if (generation !== loadGeneration.current) return false;
      setState(s => ({ ...s, phase: 'error' }));
      toast.error('Could not load your assessment. Please retry.');
      return false;
    }
  }, []);

  useEffect(() => {
    const requests = loadGeneration;
    void load();
    return () => { requests.current++; };
  }, [load]);

  /** Create a fresh draft (or resume the existing one) and enter the wizard. */
  const start = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState(s => ({ ...s, starting: true }));
    try {
      const { data: { user }, error: userError } = await withAuthDeadline(() => supabase.auth.getUser());
      if (userError) throw userError;
      if (!user) { setState((s) => ({ ...s, phase: "signed_out" })); return; }
      // Resume if a draft already exists (the unique index guarantees ≤1).
      const { data: existing, error: existingError } = await withAuthDeadline(signal => supabase.from("skill_assessment_attempts" as never)
        .select("id").eq("player_id", user.id).eq("status", "in_progress").abortSignal(signal).maybeSingle());
      if (existingError) throw existingError;
      const attemptId = (existing as unknown as { id: string } | null)?.id ?? null;
      if (!attemptId) {
        const { error } = await withAuthDeadline(signal => supabase.from("skill_assessment_attempts" as never)
          .insert({ player_id: user.id, assessment_version: ASSESSMENT_VERSION, assessment_type: "full", status: "in_progress" } as never)
          .select("id").abortSignal(signal).single());
        // Another tab may have created the one permitted draft after our read.
        if (error && error.code !== '23505') throw error;
      }
      // Reload persisted answers even when another tab created the draft.
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the assessment");
    } finally {
      inFlight.current = false;
      setState(s => ({ ...s, starting: false }));
    }
  }, [load]);

  /** Persist one answer, then advance; failed writes leave the question open. */
  const answer = useCallback(async (itemKey: string, responseKey: ResponseKey) => {
    const attemptId = state.attemptId;
    if (!attemptId || inFlight.current) return false;
    inFlight.current = true;
    setState((s) => ({ ...s, saving: true }));
    try {
    const value = RESPONSE_MASTERY[responseKey];
    const { error } = await withAuthDeadline(signal => supabase.from("skill_assessment_responses" as never)
      .upsert({
        attempt_id: attemptId,
        item_key: itemKey,
        response_key: responseKey,
        response_value: value,
        was_skipped: false,
      } as never, { onConflict: "attempt_id,item_key" } as never).abortSignal(signal));
    if (error) throw error;
    // Advance only after persistence succeeds. A failed write keeps the same
    // question and selection visible so it can be retried without data loss.
    // The answer is already durable. Metadata must never hold up progression.
    void withAuthDeadline(signal => supabase.from("skill_assessment_attempts" as never)
      .update({ last_activity_at: new Date().toISOString() } as never).eq("id", attemptId).abortSignal(signal))
      .catch(() => { /* Best effort; do not retry a write automatically. */ });
    setState((s) => ({ ...s, responses: { ...s.responses, [itemKey]: responseKey } }));
    return true;
    } catch {
      toast.error("That answer didn't save — check your connection and try again.");
      return false;
    } finally {
      inFlight.current = false;
      setState((s) => ({ ...s, saving: false }));
    }
  }, [state.attemptId]);

  /**
   * Finalize via the server-authoritative edge function. The client's local
   * score is a PROVISIONAL preview only (loading fallback / dev parity check)
   * — it is never persisted as authoritative. The server independently
   * recomputes from the stored responses; its result always wins. Idempotent:
   * a retry after a timeout returns the already-stored result rather than
   * duplicating or recalculating.
   */
  const finalize = useCallback(async () => {
    if (!state.attemptId || inFlight.current) return;
    inFlight.current = true;
    setState((s) => ({ ...s, phase: "finalizing" }));
    const provisional = scoreAssessment(state.assessmentVersion === 2 ? QUESTION_BANK_V2 : QUESTION_BANK_V1, state.responses);
    try {
      const { data, error } = await withAuthDeadline(signal => supabase.functions.invoke("skill-complete", {
        body: { attemptId: state.attemptId, finalResponses: state.responses },
        signal,
      }), 25_000);
      if (error) throw error;
      const payload = (data ?? {}) as { snapshot?: ScoringSnapshot; error?: string; message?: string };
      if (payload.error) throw new Error(payload.message || payload.error);
      // Dev-only diagnostics: the server result is authoritative regardless.
      if (payload.snapshot && Math.abs((payload.snapshot.estimatedLevelRaw ?? 0) - provisional.estimatedLevelRaw) > 0.001) {
        console.warn("[skill] server/client scoring mismatch — using server result", {
          server: payload.snapshot.estimatedLevelRaw,
          client: provisional.estimatedLevelRaw,
        });
      }
      if (await load()) haptic("success"); // Only confirm after loading the stored result.
    } catch (e) {
      // Never lose a completed assessment to a failed result request — a
      // retry is safe (the edge function is idempotent), and if it already
      // completed server-side, reload() surfaces the stored result.
      toast.error(e instanceof Error ? `Couldn't save your results: ${e.message}` : "Couldn't save your results");
      await load();
      // load() keeps an unfinished retake open even if an older result exists.
    } finally {
      inFlight.current = false;
    }
  }, [state.attemptId, state.responses, state.assessmentVersion, load]);

  /** Abandon the current draft and begin a new one. */
  const restart = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState(s => ({ ...s, starting: true }));
    try {
      if (state.attemptId) {
        const { error } = await withAuthDeadline(signal => supabase.from("skill_assessment_attempts" as never)
          .delete().eq("id", state.attemptId).eq("status", "in_progress").abortSignal(signal));
        if (error) throw error;
      }
      setState((s) => ({ ...s, attemptId: null, responses: {} }));
    } catch {
      toast.error('Could not restart your assessment. Please retry.');
      return;
    } finally {
      inFlight.current = false;
      setState(s => ({ ...s, starting: false }));
    }
    await start();
  }, [state.attemptId, start]);

  const showIntro = useCallback(() => setState((s) => ({ ...s, phase: "intro" })), []);
  const showResult = useCallback(() => setState((s) => ({ ...s, phase: "result" })), []);

  // Derived (pure) values for the wizard.
  const bank = state.assessmentVersion === 2 ? QUESTION_BANK_V2 : QUESTION_BANK_V1;
  const cfg = state.assessmentVersion === 2 ? ADAPTIVE_CONFIG_V2 : DEFAULT_ADAPTIVE_CONFIG;
  const nextItemKey = state.phase === "in_progress"
    ? selectNextItemKey(bank, state.responses, cfg)
    : null;
  const answeredCount = Object.keys(state.responses).length;
  const complete = isComplete(bank, state.responses, cfg);
  const runningSnapshot = answeredCount > 0 ? scoreAssessment(bank, state.responses) : null;

  return {
    ...state,
    bank,
    canFinalize: complete && (state.assessmentVersion === 2 ? !!runningSnapshot?.meta.evidence?.sufficient : (runningSnapshot?.meta.scoredCount ?? 0) >= 20),
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
