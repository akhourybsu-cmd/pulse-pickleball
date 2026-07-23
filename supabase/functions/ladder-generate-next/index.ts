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
import { groupIntoFours, batchMatchups, LadderError } from '../_shared/leagues/ladder.ts'

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

    const { season_id } = await req.json()
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

    // ---- seed order = result snapshot of the last processed batch -----
    const { data: startSnap } = await supabase
      .from('ladder_snapshots').select('*')
      .eq('id', last.result_snapshot_id as string).maybeSingle()
    if (!startSnap) return json({ error: 'Processed result snapshot missing' }, 500)
    const order = startSnap.player_ids as string[]

    // ---- build the batch structure with the tested engine ------------
    let groups
    try {
      groups = groupIntoFours(order).map((grp, gi) => ({
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
        // Same-week next batch shares the session; a new week starts with no
        // session until the organizer schedules that week.
        session_id: sameWeek ? (last.session_id ?? null) : null,
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

    return json({
      success: true, kind, week: nextWeek, batch: nextBatch,
      ...(result as Record<string, unknown>),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('ladder-generate-next error:', message)
    return json({ error: message }, 500)
  }
})
