// =====================================================================
// ladder-finalize-batch  (PROCESS-ONLY)
//
// Server-side (authoritative) PROCESSING of a ladder batch. Runs the
// TESTED pure engine against the REAL scores in the DB — the client never
// supplies ladder positions or movement — then hands a plan to the
// transactional ladder_finalize_batch RPC, which persists it atomically
// and idempotently (row lock + unique keys).
//
// This function DOES NOT generate the next batch or week. Per the
// sequential-progression spec, generation is an EXPLICIT organizer step
// (ladder-generate-next-batch / ladder-generate-next-week). Processing a
// batch only computes the resulting ladder order + movements and stores
// the result snapshot, unlocking the next generation action.
//
// Runs as the CALLING USER (anon key + their JWT) so RLS + the RPC's
// is_league_admin check apply — no service role, no privilege escalation.
//
// Ties that decide who moves up/down can't always be settled by scores (in a
// single 4-player batch every pair splits their head-to-head). When the engine
// finds such a tie it is NOT resolved silently — this function returns
// `tiebreak_required` with the tied players, and the organizer re-invokes with
// `tie_resolutions` (e.g. the result of a skinny-singles game) to say who
// advances.
//
// Body: { "batch_id": "<uuid>", "tie_resolutions"?: { "<groupIndex>": ["<playerId>", …] } }
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeBatchOutcome, detectTieBreaks,
  type LadderGameResult,
} from '../_shared/leagues/ladder.ts'

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

    // Act as the caller so RLS + is_league_admin gate every read/write.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { batch_id, tie_resolutions } = await req.json()
    if (!batch_id) return json({ error: 'batch_id required' }, 400)

    // Normalize organizer tiebreak resolutions to { [groupIndex:number]: id[] }.
    const resolutions: Record<number, string[]> = {}
    if (tie_resolutions && typeof tie_resolutions === 'object') {
      for (const [k, v] of Object.entries(tie_resolutions as Record<string, unknown>)) {
        if (Array.isArray(v)) resolutions[Number(k)] = v as string[]
      }
    }

    // ---- load batch, start snapshot, settings, groups, games ----------
    const { data: batch } = await supabase
      .from('ladder_batches').select('*').eq('id', batch_id).maybeSingle()
    if (!batch) return json({ error: 'Batch not found (or not accessible)' }, 404)
    if (batch.status === 'finalized') {
      return json({ already_finalized: true, batch_id, result_snapshot_id: batch.result_snapshot_id })
    }

    const { data: startSnap } = await supabase
      .from('ladder_snapshots').select('*').eq('id', batch.start_snapshot_id).maybeSingle()
    if (!startSnap) return json({ error: 'Start snapshot missing' }, 500)

    const { data: groups } = await supabase
      .from('ladder_batch_groups').select('*')
      .eq('batch_id', batch_id).order('group_index', { ascending: true })
    if (!groups || groups.length === 0) return json({ error: 'Batch has no groups' }, 500)

    const groupIds = groups.map((g: { id: string }) => g.id)
    const { data: games } = await supabase
      .from('league_matches').select('*')
      .in('ladder_batch_group_id', groupIds)

    // ---- completeness (friendly pre-check; the RPC re-checks too) ------
    const incomplete = (games ?? []).filter((m: Record<string, unknown>) =>
      m.team_a_score == null || m.team_b_score == null
      || m.team_a_score === m.team_b_score
      || !['verified', 'score_submitted'].includes(m.status as string),
    )
    if (incomplete.length > 0 || (games ?? []).length < groups.length * 3) {
      return json({
        error: 'batch_incomplete',
        message: `Every game must have a verified final score before the batch can finalize (${incomplete.length} remaining).`,
      }, 409)
    }

    // ---- build gamesByGroup in group order for the engine -------------
    const gamesByGroup: LadderGameResult[][] = groups.map((g: { id: string }) => {
      const gGames = (games ?? [])
        .filter((m: Record<string, unknown>) => m.ladder_batch_group_id === g.id)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((a.ladder_game_number as number) ?? 0) - ((b.ladder_game_number as number) ?? 0))
      return gGames.map((m: Record<string, unknown>) => ({
        game: (m.ladder_game_number as number) ?? 0,
        sideA: [m.player_a_id as string, m.player_b_id as string] as [string, string],
        sideB: [m.player_c_id as string, m.player_d_id as string] as [string, string],
        scoreA: m.team_a_score as number,
        scoreB: m.team_b_score as number,
      }))
    })

    const order: string[] = startSnap.player_ids as string[]

    // ---- tiebreaks: any tie that decides a move needs organizer input --
    const needs = detectTieBreaks(order, gamesByGroup)
    const unresolved = needs.filter((n) => {
      const provided = resolutions[n.groupIndex]
      if (!provided) return true
      // Every tied player must be named in the resolution for that group.
      const set = new Set(provided)
      return n.tiedPlayerIds.some((id) => !set.has(id))
    })
    if (unresolved.length > 0) {
      return json({
        error: 'tiebreak_required',
        message: 'One or more courts ended in a tie that decides who moves up or down. Enter the tiebreaker result to continue.',
        ties: unresolved.map((n) => ({
          group_index: n.groupIndex,
          court_number: (groups[n.groupIndex] as { court_number?: number | null })?.court_number
            ?? n.groupIndex + 1,
          boundaries: n.boundaries,
          player_ids: n.tiedPlayerIds,
        })),
      }, 409)
    }

    // ---- run the tested engine (with organizer resolutions) -----------
    const outcome = computeBatchOutcome(order, gamesByGroup, resolutions)

    // ---- movements plan (with the group id each player belonged to) ---
    const movements = outcome.rankedByGroup.flatMap((rows, gi) =>
      rows.map((s) => ({
        player_id: s.playerId,
        group_id: groups[gi].id,
        start_position: s.startPosition,
        finish_position: s.finishPosition,
        direction: outcome.movements[s.playerId]?.direction ?? 'stay',
        capped: outcome.movements[s.playerId]?.capped ?? null,
        wins: s.wins, losses: s.losses,
        points_for: s.pointsFor, points_against: s.pointsAgainst,
      })),
    )

    // ---- build the PROCESS plan (no downstream generation) ------------
    const week = batch.week_number as number
    const bnum = batch.batch_number as number

    const plan = {
      result_snapshot: {
        week, batch: bnum,
        player_ids: outcome.nextOrder,
        reason: `week ${week} batch ${bnum} processed`,
        idempotency_key: `res:${batch.season_id}:${week}:${bnum}`,
      },
      movements,
    }

    // ---- persist atomically via the guarded RPC ----------------------
    const { data: result, error } = await supabase.rpc('ladder_finalize_batch', {
      p_batch_id: batch_id,
      p_plan: plan,
    })
    if (error) return json({ error: error.message }, 400)

    return json({ success: true, ...(result as Record<string, unknown>) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('ladder-finalize-batch error:', message)
    return json({ error: message }, 500)
  }
})
