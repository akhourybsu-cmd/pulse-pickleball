// =====================================================================
// ladder-generate-next  (EXPLICIT organizer action)
//
// Generates the NEXT ladder stage — either the next batch of the current
// week, or Batch 1 of the next week — from the ladder order produced by
// the most recently PROCESSED batch. This is only ever invoked by an
// explicit organizer button press; nothing here runs automatically.
//
// Sequential-progression guarantees enforced here (and re-checked in the
// RPC):
//   • The current stage must be fully PROCESSED first: there must be no
//     unfinalized (active) batch in the season. If one exists we refuse —
//     the organizer must process it before the next stage can be built.
//   • The next WEEK is never created implicitly. Crossing a week boundary
//     only happens when the final batch of the current week is processed,
//     and even then only via this explicit call.
//   • Idempotent: the RPC keys on `batch:<season>:<week>:<batch>`, so a
//     double press returns the same batch instead of duplicating it.
//
// Runs as the caller (RLS + is_league_admin apply). No service role.
//
// Body: { "season_id": "<uuid>" }
// Returns: { success, batch_id, week, batch, kind: "batch" | "week", done? }
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { groupIntoFours, batchMatchups, excludeSitouts, LadderError } from '../_shared/leagues/ladder.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { season_id, session_id } = await req.json() as {
      season_id?: string; session_id?: string | null;
    }
    if (!season_id) return json({ error: 'season_id required' }, 400)

    // ---- settings -----------------------------------------------------
    const { data: settings } = await supabase
      .from('ladder_settings').select('*').eq('season_id', season_id).maybeSingle()
    if (!settings) return json({ error: 'Ladder settings not found' }, 404)
    const batchesPerWeek = Math.max(1, settings.batches_per_week ?? 1)
    const totalWeeks: number | null = settings.total_weeks ?? null
    const courtCount = Math.max(1, settings.court_count ?? 1)

    // ---- all batches for the season ----------------------------------
    const { data: batchRows } = await supabase
      .from('ladder_batches').select('*')
      .eq('season_id', season_id)
      .order('week_number', { ascending: true })
      .order('batch_number', { ascending: true })
    const batches = (batchRows ?? []) as Array<Record<string, unknown>>
    if (batches.length === 0) {
      return json({ error: 'no_batches', message: 'No batches yet — generate the first batch to start the ladder.' }, 409)
    }

    // GUARD: current stage must be processed — no active (unfinalized) batch.
    const active = batches.find(
      (b) => b.status !== 'finalized' && b.status !== 'invalidated',
    )
    if (active) {
      return json({
        error: 'current_stage_not_processed',
        message: `Week ${active.week_number} Batch ${active.batch_number} must be processed before the next stage can be generated.`,
      }, 409)
    }

    // Latest PROCESSED batch drives the next stage.
    const finalized = batches.filter((b) => b.status === 'finalized')
    const last = finalized.reduce((acc, b) =>
      (b.week_number as number) > (acc.week_number as number)
      || ((b.week_number as number) === (acc.week_number as number)
          && (b.batch_number as number) > (acc.batch_number as number))
        ? b : acc, finalized[0])

    const lastWeek = last.week_number as number
    const lastBatch = last.batch_number as number

    // ---- decide the next stage ---------------------------------------
    let nextWeek: number, nextBatch: number, kind: 'batch' | 'week', sameWeek: boolean
    if (lastBatch < batchesPerWeek) {
      nextWeek = lastWeek; nextBatch = lastBatch + 1; kind = 'batch'; sameWeek = true
    } else if (totalWeeks == null || lastWeek < totalWeeks) {
      nextWeek = lastWeek + 1; nextBatch = 1; kind = 'week'; sameWeek = false
    } else {
      return json({
        success: true, done: true,
        message: `The ladder is complete — all ${totalWeeks} week(s) have been processed.`,
      })
    }

    // GUARD: target stage must not already exist.
    if (batches.some((b) => b.week_number === nextWeek && b.batch_number === nextBatch)) {
      return json({
        error: 'stage_exists',
        message: `Week ${nextWeek} Batch ${nextBatch} already exists.`,
      }, 409)
    }

    // The session this stage fills: a same-week batch reuses the current
    // week's session; a new week uses the organizer-selected/created session.
    const effectiveSessionId: string | null = sameWeek
      ? ((last.session_id as string | null) ?? null)
      : (session_id ?? null)

    // A NEW WEEK must be scheduled first — the client selects a pre-scheduled
    // session or creates one, then passes its id. No session → prompt.
    if (kind === 'week' && !effectiveSessionId) {
      return json({
        error: 'no_session',
        message: `Schedule Week ${nextWeek} (set its date) before generating it.`,
      }, 409)
    }

    // GATE: every sub-request for this week's session must be resolved
    // (a specific fill-in assigned, sat out, or declined) before generating.
    if (kind === 'week' && effectiveSessionId) {
      const { data: pendRows } = await supabase
        .from('ladder_sub_requests').select('player_id')
        .eq('session_id', effectiveSessionId).eq('status', 'pending')
      if ((pendRows ?? []).length > 0) {
        return json({
          error: 'unresolved_requests',
          message: `${(pendRows ?? []).length} sub request(s) for Week ${nextWeek} still need a decision.`,
        }, 409)
      }
    }

    // ---- seed order = result snapshot of the last processed batch -----
    const { data: startSnap } = await supabase
      .from('ladder_snapshots').select('*')
      .eq('id', last.result_snapshot_id as string).maybeSingle()
    if (!startSnap) return json({ error: 'Processed result snapshot missing' }, 500)
    const order = startSnap.player_ids as string[]

    // ---- sit-outs: players with no sub this week close ranks out ------
    // The full ladder stays the batch's start snapshot; only the PRESENT
    // players are grouped. They must still number a multiple of four
    // (excludeSitouts enforces it — the organizer resolves any shortfall).
    const { data: sitRows } = await supabase
      .from('ladder_week_sitouts').select('player_id')
      .eq('season_id', season_id).eq('week_number', nextWeek)
    const sitSet = new Set((sitRows ?? []).map((r: { player_id: string }) => r.player_id))
    // Only sit players actually on the ladder (defensive against stale rows).
    const effectiveSitouts = order.filter((p) => sitSet.has(p))

    // ---- build the batch structure with the tested engine ------------
    let present: string[]
    try {
      present = excludeSitouts(order, effectiveSitouts)
    } catch (e) {
      if (e instanceof LadderError) {
        return json({ error: 'invalid_player_count', message: e.message }, 400)
      }
      throw e
    }

    let groups
    try {
      groups = groupIntoFours(present).map((grp, gi) => ({
        group_index: gi,
        court_number: (gi % courtCount) + 1,
        wave: Math.floor(gi / courtCount) + 1,
        player_ids: grp,
        games: batchMatchups(grp).map((m) => ({
          game_number: m.game, side_a: m.sideA, side_b: m.sideB,
        })),
      }))
    } catch (e) {
      if (e instanceof LadderError) {
        return json({ error: 'invalid_player_count', message: e.message }, 400)
      }
      throw e
    }

    const plan = {
      batch: {
        week: nextWeek, batch: nextBatch,
        session_id: effectiveSessionId,
        court_waves: Math.ceil(groups.length / courtCount),
        idempotency_key: `batch:${season_id}:${nextWeek}:${nextBatch}`,
        groups,
      },
    }

    const { data: result, error } = await supabase.rpc('ladder_generate_batch', {
      p_season_id: season_id,
      p_start_snapshot_id: startSnap.id,
      p_plan: plan,
    })
    if (error) return json({ error: error.message }, 400)

    const genResult = (result ?? {}) as { batch_id?: string; already_existed?: boolean }
    const newBatchId = genResult.batch_id

    // ---- seed assigned subs into the fresh batch ----------------------
    // A 'sub' resolution keeps the absent player in the ladder (they hold
    // their rung) but the assigned fill-in plays their slots. We apply it
    // with the tested, audited per-week swap scoped to this new batch, so
    // the stand-in mapping (sub -> original for ranking) is recorded exactly
    // as an organizer's manual swap would be. Only when we actually created
    // the batch (not an idempotent re-return).
    const subSeedErrors: string[] = []
    if (newBatchId && !genResult.already_existed && effectiveSessionId) {
      const { data: subReqs } = await supabase
        .from('ladder_sub_requests')
        .select('player_id, assigned_sub_id')
        .eq('session_id', effectiveSessionId).eq('status', 'sub')
      for (const r of (subReqs ?? []) as Array<{ player_id: string; assigned_sub_id: string | null }>) {
        if (!r.assigned_sub_id) continue
        const { data: swapData, error: swapErr } = await supabase.rpc('swap_league_week_player', {
          p_league_id: settings.league_id,
          p_season_id: season_id,
          p_out_player_id: r.player_id,
          p_in_player_id: r.assigned_sub_id,
          p_note: 'Requested sub',
          p_batch_id: newBatchId,
        })
        const swapErrMsg = swapErr?.message ?? (swapData as { error?: string } | null)?.error
        if (swapErrMsg) subSeedErrors.push(swapErrMsg)
      }
    }

    return json({
      success: true, kind, week: nextWeek, batch: nextBatch,
      ...(genResult as Record<string, unknown>),
      ...(subSeedErrors.length ? { sub_seed_errors: subSeedErrors } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('ladder-generate-next error:', message)
    return json({ error: message }, 500)
  }
})
