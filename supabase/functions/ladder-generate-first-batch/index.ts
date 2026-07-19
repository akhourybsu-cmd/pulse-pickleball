// =====================================================================
// ladder-generate-first-batch
//
// Starts a ladder season: given the resolved initial ladder order, builds
// the Week 1 / Batch 1 group + game structure with the TESTED pure engine
// and hands it to the transactional ladder_generate_first_batch RPC, which
// writes the initial snapshot + first batch atomically and idempotently.
//
// Runs as the caller (RLS + is_league_admin apply). No service role.
//
// Body: { "season_id": "<uuid>", "order": ["<playerId>", …] }
//   order length must be divisible by four (validated here and in the RPC).
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

    const { season_id, order } = await req.json()
    if (!season_id || !Array.isArray(order)) {
      return json({ error: 'season_id and order[] required' }, 400)
    }

    const { data: settings } = await supabase
      .from('ladder_settings').select('*').eq('season_id', season_id).maybeSingle()
    const courtCount = Math.max(1, settings?.court_count ?? 1)

    // Build the first batch structure with the tested engine.
    let groups
    try {
      groups = groupIntoFours(order as string[]).map((grp, gi) => ({
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
      order,
      initial_idempotency_key: `init:${season_id}`,
      first_batch: {
        week: 1, batch: 1, session_id: null,
        court_waves: Math.ceil(groups.length / courtCount),
        idempotency_key: `batch:${season_id}:1:1`,
        groups,
      },
    }

    const { data: result, error } = await supabase.rpc('ladder_generate_first_batch', {
      p_season_id: season_id,
      p_plan: plan,
    })
    if (error) return json({ error: error.message }, 400)

    return json({ success: true, ...(result as Record<string, unknown>) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('ladder-generate-first-batch error:', message)
    return json({ error: message }, 500)
  }
})
