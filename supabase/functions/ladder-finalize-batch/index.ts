// =====================================================================
// ladder-finalize-batch
//
// Server-side (authoritative) finalization of a ladder batch. Runs the
// TESTED pure engine against the REAL scores in the DB — the client never
// supplies ladder positions or movement — then hands a plan to the
// transactional ladder_finalize_batch RPC, which persists it atomically
// and idempotently (row lock + unique keys).
//
// Runs as the CALLING USER (anon key + their JWT) so RLS + the RPC's
// is_league_admin check apply — no service role, no privilege escalation.
//
// Body: { "batch_id": "<uuid>" }
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeBatchOutcome, groupIntoFours, batchMatchups,
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

    const { batch_id } = await req.json()
    if (!batch_id) return json({ error: 'batch_id required' }, 400)

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

    const { data: settings } = await supabase
      .from('ladder_settings').select('*').eq('season_id', batch.season_id).maybeSingle()
    const batchesPerWeek = settings?.batches_per_week ?? 1
    const totalWeeks = settings?.total_weeks ?? null
    const courtCount = Math.max(1, settings?.court_count ?? 1)

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

    // ---- run the tested engine ---------------------------------------
    const outcome = computeBatchOutcome(order, gamesByGroup)

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

    // ---- decide whether another batch follows -------------------------
    const week = batch.week_number as number
    const bnum = batch.batch_number as number
    let next: Record<string, unknown> | null = null
    let nextWeek = 0, nextBatch = 0, sameWeek = false
    if (bnum < batchesPerWeek) { nextWeek = week; nextBatch = bnum + 1; sameWeek = true }
    else if (totalWeeks == null || week < totalWeeks) { nextWeek = week + 1; nextBatch = 1 }

    if (nextWeek > 0) {
      const nextGroups = groupIntoFours(outcome.nextOrder).map((grp, gi) => ({
        group_index: gi,
        court_number: (gi % courtCount) + 1,
        wave: Math.floor(gi / courtCount) + 1,
        player_ids: grp,
        games: batchMatchups(grp).map((m) => ({
          game_number: m.game,
          side_a: m.sideA,
          side_b: m.sideB,
        })),
      }))
      next = {
        week: nextWeek,
        batch: nextBatch,
        // Same-week next batch shares the session; next week's session is
        // attached by the organizer when that week is scheduled.
        session_id: sameWeek ? (batch.session_id ?? null) : null,
        court_waves: Math.ceil(nextGroups.length / courtCount),
        idempotency_key: `batch:${batch.season_id}:${nextWeek}:${nextBatch}`,
        groups: nextGroups,
      }
    }

    const plan = {
      result_snapshot: {
        week, batch: bnum,
        player_ids: outcome.nextOrder,
        reason: `week ${week} batch ${bnum} finalized`,
        idempotency_key: `res:${batch.season_id}:${week}:${bnum}`,
      },
      movements,
      next,
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
