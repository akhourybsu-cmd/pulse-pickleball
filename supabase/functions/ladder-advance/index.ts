// =====================================================================
// ladder-advance  (organizer-independent, self-directed progression)
//
// Moves a ladder forward WITHOUT a league admin present. Any participant's
// client fires this after entering the last score; it can also be run on a
// schedule. It is safe to call by anyone and safe to call repeatedly — it
// only ever performs the "responsible" action and is fully idempotent.
//
// It runs with the SERVICE ROLE so it can process/generate on behalf of the
// league, but it enforces its own guardrails rather than trusting the caller:
//
//   • Does nothing unless the season's `auto_advance` setting is on.
//   • Only acts on a FULLY COMPLETE batch (every game scored + counted).
//   • Refuses to guess a tie: if a court ends tied at a spot that decides
//     who moves up/down, it stops and leaves the tiebreak for a human.
//   • Processes the complete batch, then generates the NEXT BATCH IN THE
//     SAME WEEK only. It never crosses a week boundary — starting the next
//     week stays an explicit organizer action.
//
// Body: { "season_id": "<uuid>" }
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeBatchOutcome, detectTieBreaks, groupIntoFours, batchMatchups,
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
    // Trusted server context — service role. Guardrails below are what keep
    // this safe, NOT the caller's identity.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { season_id } = await req.json()
    if (!season_id) return json({ error: 'season_id required' }, 400)

    // ---- settings gate -----------------------------------------------
    const { data: settings } = await supabase
      .from('ladder_settings').select('*').eq('season_id', season_id).maybeSingle()
    if (!settings) return json({ skipped: 'no_settings' })
    if (!settings.auto_advance) return json({ skipped: 'auto_advance_off' })
    if (settings.status === 'paused') return json({ skipped: 'paused' })
    const batchesPerWeek = Math.max(1, settings.batches_per_week ?? 1)
    const courtCount = Math.max(1, settings.court_count ?? 1)

    // ---- find the active batch ---------------------------------------
    const { data: batchRows } = await supabase
      .from('ladder_batches').select('*')
      .eq('season_id', season_id)
      .order('week_number', { ascending: true })
      .order('batch_number', { ascending: true })
    const batches = (batchRows ?? []) as Array<Record<string, unknown>>
    const active = batches.find(
      (b) => b.status !== 'finalized' && b.status !== 'invalidated',
    )
    if (!active) return json({ skipped: 'no_active_batch' })

    const batchId = active.id as string
    const { data: startSnap } = await supabase
      .from('ladder_snapshots').select('*').eq('id', active.start_snapshot_id as string).maybeSingle()
    if (!startSnap) return json({ error: 'start snapshot missing' }, 500)

    const { data: groups } = await supabase
      .from('ladder_batch_groups').select('*')
      .eq('batch_id', batchId).order('group_index', { ascending: true })
    if (!groups || groups.length === 0) return json({ skipped: 'no_groups' })

    const groupIds = groups.map((g: { id: string }) => g.id)
    const { data: games } = await supabase
      .from('league_matches').select('*').in('ladder_batch_group_id', groupIds)

    // ---- completeness: every game scored + counted -------------------
    const incomplete = (games ?? []).filter((m: Record<string, unknown>) =>
      m.team_a_score == null || m.team_b_score == null
      || m.team_a_score === m.team_b_score
      || !['verified', 'score_submitted'].includes(m.status as string),
    )
    if (incomplete.length > 0 || (games ?? []).length < groups.length * 3) {
      return json({ skipped: 'incomplete', remaining: incomplete.length })
    }

    // ---- build engine input ------------------------------------------
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

    // ---- refuse to guess a tie ---------------------------------------
    const needs = detectTieBreaks(order, gamesByGroup)
    if (needs.length > 0) {
      return json({
        skipped: 'tiebreak_required',
        courts: needs.map((n) => ({
          court_number: (groups[n.groupIndex] as { court_number?: number | null })?.court_number
            ?? n.groupIndex + 1,
          boundaries: n.boundaries,
        })),
      })
    }

    // ---- process the complete batch ----------------------------------
    const outcome = computeBatchOutcome(order, gamesByGroup)
    const movements = outcome.rankedByGroup.flatMap((rows, gi) =>
      rows.map((s) => ({
        player_id: s.playerId, group_id: (groups[gi] as { id: string }).id,
        start_position: s.startPosition, finish_position: s.finishPosition,
        direction: outcome.movements[s.playerId]?.direction ?? 'stay',
        capped: outcome.movements[s.playerId]?.capped ?? null,
        wins: s.wins, losses: s.losses,
        points_for: s.pointsFor, points_against: s.pointsAgainst,
      })),
    )
    const week = active.week_number as number
    const bnum = active.batch_number as number
    const { error: procErr } = await supabase.rpc('ladder_finalize_batch', {
      p_batch_id: batchId,
      p_plan: {
        result_snapshot: {
          week, batch: bnum, player_ids: outcome.nextOrder,
          reason: `week ${week} batch ${bnum} auto-processed`,
          idempotency_key: `res:${season_id}:${week}:${bnum}`,
        },
        movements,
      },
    })
    if (procErr) return json({ error: procErr.message, phase: 'process' }, 400)

    // ---- generate the next batch IN THE SAME WEEK only ---------------
    if (bnum >= batchesPerWeek) {
      return json({ advanced: true, processed: { week, batch: bnum }, week_complete: true })
    }

    // The result snapshot we just wrote is the seed for the next batch.
    const { data: resultSnap } = await supabase
      .from('ladder_snapshots').select('id')
      .eq('idempotency_key', `res:${season_id}:${week}:${bnum}`).maybeSingle()
    if (!resultSnap) return json({ error: 'processed snapshot missing', phase: 'generate' }, 500)

    const nextBatch = bnum + 1
    const nextGroups = groupIntoFours(outcome.nextOrder).map((grp, gi) => ({
      group_index: gi,
      court_number: (gi % courtCount) + 1,
      wave: Math.floor(gi / courtCount) + 1,
      player_ids: grp,
      games: batchMatchups(grp).map((m) => ({
        game_number: m.game, side_a: m.sideA, side_b: m.sideB,
      })),
    }))
    const { error: genErr } = await supabase.rpc('ladder_generate_batch', {
      p_season_id: season_id,
      p_start_snapshot_id: resultSnap.id,
      p_plan: {
        batch: {
          week, batch: nextBatch,
          session_id: active.session_id ?? null,
          court_waves: Math.ceil(nextGroups.length / courtCount),
          idempotency_key: `batch:${season_id}:${week}:${nextBatch}`,
          groups: nextGroups,
        },
      },
    })
    if (genErr) return json({ error: genErr.message, phase: 'generate' }, 400)

    return json({
      advanced: true,
      processed: { week, batch: bnum },
      generated: { week, batch: nextBatch },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('ladder-advance error:', message)
    return json({ error: message }, 500)
  }
})
