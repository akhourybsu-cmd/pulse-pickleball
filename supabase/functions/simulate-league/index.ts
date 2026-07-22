// =====================================================================
// simulate-league — one-click, admin-only league simulation.
//
// Builds a fully-populated league ON THE CALLER'S ACCOUNT so an
// organizer can immediately view / edit / adjust a realistic schedule:
//
//   • ensures N test players exist (auth users + profiles)
//   • creates a league OWNED BY THE CALLER (created_by = caller) so
//     they get full organizer control via is_league_admin()
//   • one season (default 8 weeks), one division, all players enrolled
//   • pairs players into doubles teams
//   • one session per week
//   • a round-robin schedule across the weeks (circle method) — past
//     weeks land as VERIFIED with scores so standings populate; future
//     weeks stay SCHEDULED so the organizer has something to edit
//   • the caller is enrolled as an active manager so the league shows
//     up in their own "My Leagues"
//
// Runs with the service role, so it bypasses RLS to write on the
// caller's behalf. Admin-gated exactly like create-test-accounts.
//
// Re-running is safe: any prior simulation league owned by the caller
// (tagged in its description) is deleted first (cascade), so you always
// get one clean simulated league. Test player ACCOUNTS are reused.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIM_MARKER = '[pulse-sim]'

// A pool of friendly names so the simulated roster reads like real
// people instead of "Test Account 17".
const FIRST_NAMES = [
  'Ava', 'Liam', 'Maya', 'Noah', 'Zoe', 'Ethan', 'Priya', 'Diego',
  'Chloe', 'Marcus', 'Sofia', 'Omar', 'Grace', 'Kai', 'Nina', 'Leo',
  'Aria', 'Jonah', 'Ruby', 'Theo', 'Lena', 'Cole', 'Iris', 'Max',
  'Elena', 'Sam', 'Tara', 'Ben', 'Nora', 'Jack', 'Mila', 'Owen',
  'Layla', 'Finn', 'Rosa', 'Hugo', 'Vera', 'Eli', 'Dana', 'Reid',
]
const LAST_INITIALS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function playerName(i: number): { first: string; last: string; full: string } {
  const first = FIRST_NAMES[i % FIRST_NAMES.length]
  const last = LAST_INITIALS[i % LAST_INITIALS.length] + '.'
  return { first, last, full: `${first} ${last}` }
}

// Circle-method round-robin. Given team indices 0..n-1 (n even), yields
// `rounds` rounds; each round is a list of [a, b] index pairs where every
// team plays exactly once. Consecutive rounds pair distinct opponents.
function roundRobinRounds(n: number, rounds: number): Array<Array<[number, number]>> {
  const list = Array.from({ length: n }, (_, i) => i)
  const half = n / 2
  const out: Array<Array<[number, number]>> = []
  for (let r = 0; r < rounds; r++) {
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < half; i++) {
      pairs.push([list[i], list[n - 1 - i]])
    }
    out.push(pairs)
    // Rotate everything except the first element.
    const fixed = list[0]
    const rest = list.slice(1)
    rest.unshift(rest.pop() as number)
    list.splice(0, list.length, fixed, ...rest)
  }
  return out
}

// Deterministic-ish pickleball score. Winner is 11 (or 12/13 for a couple
// of tight games); loser is 3..9. Seeded by the two team indices + round
// so the same simulation replays the same scoreboard.
function fakeScore(seed: number): { a: number; b: number } {
  const rnd = (n: number) => {
    // xorshift-ish on the seed for stable pseudo-randomness
    let x = (seed + n * 2654435761) >>> 0
    x ^= x << 13; x >>>= 0
    x ^= x >> 17
    x ^= x << 5; x >>>= 0
    return x / 0xffffffff
  }
  const aWins = rnd(1) > 0.5
  const winScore = rnd(2) > 0.85 ? 11 + Math.floor(rnd(3) * 3) : 11
  const loseScore = 3 + Math.floor(rnd(4) * 7) // 3..9
  return aWins ? { a: winScore, b: loseScore } : { a: loseScore, b: winScore }
}

function mondayNWeeksAgo(weeksAgo: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay() // 0=Sun
  const diffToMonday = (day + 6) % 7
  d.setUTCDate(d.getUTCDate() - diffToMonday - weeksAgo * 7)
  return d
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ---- auth + admin gate (mirrors create-test-accounts) ----
    // Also supports a service-role bypass so Lovable's server-side
    // tooling can drive the simulation on behalf of a named admin.
    const authHeader = req.headers.get('Authorization') ?? ''
    const bearerToken = authHeader.replace('Bearer ', '').trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const simAdminSecret = Deno.env.get('SIM_ADMIN_SECRET') ?? ''
    const bypassSecret = req.headers.get('x-sim-admin-secret') ?? ''
    let user: { id: string } | null = null

    // Peek at the body once so we can also read an optional
    // caller_user_id for the bypass paths.
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* no body is fine */ }

    const isBypass =
      (bearerToken && bearerToken === serviceKey && body.caller_user_id) ||
      (simAdminSecret && bypassSecret === simAdminSecret && body.caller_user_id)

    if (isBypass) {
      const callerId = String(body.caller_user_id)
      const { data: authUser } =
        await admin.auth.admin.getUserById(callerId)
      if (!authUser?.user) return json({ error: 'caller_user_id not found' }, 400)
      user = { id: authUser.user.id }
    } else {
      if (!bearerToken) return json({ error: 'Unauthorized' }, 401)
      const { data: { user: u } } = await admin.auth.getUser(bearerToken)
      if (!u) return json({ error: 'Unauthorized' }, 401)
      user = { id: u.id }
    }

    const { data: roleData } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roleData) return json({ error: 'Admin access required' }, 403)

    // ---- params (body was already parsed above) ----
    const weeks = Math.min(Math.max(Number(body.weeks) || 8, 2), 15)
    const playerCount = (() => {
      const n = Number(body.playerCount) || 32
      // keep it even and within a sane range
      const clamped = Math.min(Math.max(n, 8), 40)
      return clamped % 2 === 0 ? clamped : clamped - 1
    })()
    const leagueName = String(body.leagueName || 'Eight Week Doubles Ladder')
    const teamCount = playerCount / 2

    // ==========================================================
    // 1. Ensure test players exist
    // ==========================================================
    const playerIds: string[] = []
    for (let i = 0; i < playerCount; i++) {
      const email = `leaguesim${i + 1}@pulsetest.local`
      const password = 'TestPassword123!'
      const nm = playerName(i)

      let uid: string | null = null
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: nm.full, display_name: nm.full },
        })

      if (createErr) {
        if (createErr.message.includes('already') || createErr.message.includes('registered')) {
          // Reuse the existing account. Page through until we find it.
          let page = 1
          while (!uid && page <= 20) {
            const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
            const found = list?.users?.find((u) => u.email === email)
            if (found) uid = found.id
            if (!list || (list.users?.length ?? 0) < 200) break
            page++
          }
        } else {
          throw createErr
        }
      } else {
        uid = created?.user?.id ?? null
      }

      if (!uid) throw new Error(`Could not resolve test user ${email}`)
      playerIds.push(uid)

      // Backfill profile fields (varied ratings for realistic standings).
      const rating = 3.0 + ((i * 7) % 16) / 10 // 3.0 .. 4.5
      await admin.from('profiles').update({
        full_name: nm.full,
        display_name: nm.full,
        first_name: nm.first,
        last_name: nm.last,
        email,
        current_rating: rating,
      }).eq('id', uid)
    }

    // ==========================================================
    // 2. Reset any prior simulation league owned by the caller
    // ==========================================================
    const { data: priorLeagues } = await admin
      .from('leagues')
      .select('id')
      .eq('created_by', user.id)
      .ilike('description', `%${SIM_MARKER}%`)
    if (priorLeagues && priorLeagues.length) {
      await admin.from('leagues')
        .delete()
        .in('id', priorLeagues.map((l: { id: string }) => l.id))
      // Children cascade via ON DELETE CASCADE.
    }

    // ==========================================================
    // 3. League (owned by caller), season, division
    // ==========================================================
    const startDate = mondayNWeeksAgo(Math.min(4, weeks - 1)) // ~half the season already played
    const endDate = new Date(startDate)
    endDate.setUTCDate(endDate.getUTCDate() + weeks * 7 - 1)

    const { data: league, error: leagueErr } = await admin
      .from('leagues')
      .insert({
        name: leagueName,
        description:
          `Simulated ${weeks}-week doubles ladder with ${playerCount} players ` +
          `across ${teamCount} teams. ${SIM_MARKER}`,
        location: 'PULSE Simulation Courts',
        created_by: user.id,
        league_type: 'ladder',
        status: 'active',
        visibility: 'private',
        rating_eligible: false,
        guests_allowed: false,
      })
      .select('id')
      .single()
    if (leagueErr || !league) throw leagueErr ?? new Error('League insert failed')
    const leagueId = league.id as string

    const { data: season, error: seasonErr } = await admin
      .from('league_seasons')
      .insert({
        league_id: leagueId,
        name: `Season 1 · ${weeks} Weeks`,
        start_date: isoDate(startDate),
        end_date: isoDate(endDate),
        registration_deadline: isoDate(startDate),
        status: 'active',
      })
      .select('id')
      .single()
    if (seasonErr || !season) throw seasonErr ?? new Error('Season insert failed')
    const seasonId = season.id as string

    const { data: division, error: divErr } = await admin
      .from('league_divisions')
      .insert({
        league_id: leagueId,
        season_id: seasonId,
        name: 'Open (3.0–4.5)',
        skill_min: 3.0,
        skill_max: 4.5,
        description: 'All-comers doubles ladder division.',
        status: 'active',
      })
      .select('id')
      .single()
    if (divErr || !division) throw divErr ?? new Error('Division insert failed')
    const divisionId = division.id as string

    // ==========================================================
    // 4. Members — caller as manager + all players
    // ==========================================================
    const memberRows = [
      {
        league_id: leagueId, season_id: seasonId, division_id: divisionId,
        user_id: user.id, role: 'manager', status: 'active',
      },
      ...playerIds.map((uid, i) => ({
        league_id: leagueId, season_id: seasonId, division_id: divisionId,
        user_id: uid,
        // First player of each pair captains their team.
        role: i % 2 === 0 ? 'captain' : 'player',
        status: 'active',
      })),
    ]
    const { error: memErr } = await admin.from('league_members').insert(memberRows)
    if (memErr) throw memErr

    // ==========================================================
    // 5. Player pairs — this league is INDIVIDUAL-based, so these are
    //    just doubles line-ups for the schedule, not DB teams.
    // ==========================================================
    const pairs: Array<[string, string]> = []
    for (let t = 0; t < teamCount; t++) {
      pairs.push([playerIds[t * 2], playerIds[t * 2 + 1]])
    }

    // ==========================================================
    // 5b. Substitutes — a small bench the organizer can swap in
    // ==========================================================
    const SUB_COUNT = 4
    const subNotes = [
      'Weeknights only · texts fastest',
      'Available most weeks · strong 3.5',
      'Weekends preferred · consistent dinker',
      'Short notice OK · big serve',
    ]
    for (let i = 0; i < SUB_COUNT; i++) {
      const email = `leaguesimsub${i + 1}@pulsetest.local`
      const nm = playerName(playerCount + i)
      let uid: string | null = null
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email,
          password: 'TestPassword123!',
          email_confirm: true,
          user_metadata: { full_name: nm.full, display_name: nm.full },
        })
      if (createErr) {
        if (createErr.message.includes('already') || createErr.message.includes('registered')) {
          let page = 1
          while (!uid && page <= 20) {
            const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
            const found = list?.users?.find((u) => u.email === email)
            if (found) uid = found.id
            if (!list || (list.users?.length ?? 0) < 200) break
            page++
          }
        } else {
          throw createErr
        }
      } else {
        uid = created?.user?.id ?? null
      }
      if (!uid) continue
      await admin.from('profiles').update({
        full_name: nm.full, display_name: nm.full,
        first_name: nm.first, last_name: nm.last, email,
        current_rating: 3.0 + (i % 4) / 2,
      }).eq('id', uid)
      await admin.from('league_substitutes').insert({
        league_id: leagueId, season_id: seasonId, division_id: divisionId,
        user_id: uid, notes: subNotes[i % subNotes.length], status: 'active',
      })
    }

    // ==========================================================
    // 6. Sessions — one per week
    // ==========================================================
    const todayIso = isoDate(new Date())
    const sessionIds: string[] = []
    const sessionDates: string[] = []
    for (let w = 0; w < weeks; w++) {
      const d = new Date(startDate)
      d.setUTCDate(d.getUTCDate() + w * 7)
      const dateIso = isoDate(d)
      const isPast = dateIso < todayIso
      const { data: session, error: sessErr } = await admin
        .from('league_sessions')
        .insert({
          league_id: leagueId, season_id: seasonId, division_id: divisionId,
          name: `Week ${w + 1}`,
          scheduled_date: dateIso,
          start_time: '18:00',
          end_time: '21:00',
          court_count: Math.max(1, teamCount / 2),
          location: 'PULSE Simulation Courts',
          status: isPast ? 'completed' : 'published',
        })
        .select('id')
        .single()
      if (sessErr || !session) throw sessErr ?? new Error('Session insert failed')
      sessionIds.push(session.id as string)
      sessionDates.push(dateIso)
    }

    // ==========================================================
    // 7. Matches — round-robin across the weeks
    // ==========================================================
    const rounds = roundRobinRounds(teamCount, weeks)
    const matchRows: Record<string, unknown>[] = []
    for (let w = 0; w < weeks; w++) {
      const dateIso = sessionDates[w]
      const isPast = dateIso < todayIso
      const roundPairs = rounds[w]
      roundPairs.forEach(([ai, bi], idx) => {
        const [a1, a2] = pairs[ai]
        const [b1, b2] = pairs[bi]
        const court = idx + 1
        const when = new Date(`${dateIso}T18:00:00Z`)
        when.setUTCMinutes(when.getUTCMinutes() + (idx % 4) * 30)

        // Individual-based: no teams — each side is two named players.
        const base: Record<string, unknown> = {
          league_id: leagueId, season_id: seasonId, division_id: divisionId,
          session_id: sessionIds[w],
          court_number: court,
          scheduled_time: when.toISOString(),
          team_a_id: null, team_b_id: null,
          player_a_id: a1, player_b_id: a2,
          player_c_id: b1, player_d_id: b2,
          rating_status: 'not_connected',
        }

        if (isPast) {
          const s = fakeScore(w * 1000 + ai * 31 + bi)
          matchRows.push({
            ...base,
            status: 'verified',
            team_a_score: s.a,
            team_b_score: s.b,
            verified_by: [a1, b1],
            score_submitted_by: a1,
            score_submitted_at: when.toISOString(),
          })
        } else {
          matchRows.push({ ...base, status: 'scheduled', verified_by: [] })
        }
      })
    }
    // Insert in chunks to stay well under any payload limits.
    for (let i = 0; i < matchRows.length; i += 100) {
      const chunk = matchRows.slice(i, i + 100)
      const { error: matchErr } = await admin.from('league_matches').insert(chunk)
      if (matchErr) throw matchErr
    }

    // ==========================================================
    // 8. Audit + response
    // ==========================================================
    await admin.from('league_audit_log').insert({
      league_id: leagueId,
      actor_user_id: user.id,
      action: 'league.simulated',
      entity_type: 'league',
      entity_id: leagueId,
      new_value: {
        players: playerCount, teams: teamCount, weeks,
        matches: matchRows.length, via: 'simulate-league',
      },
    })

    return json({
      success: true,
      league_id: leagueId,
      season_id: seasonId,
      division_id: divisionId,
      players: playerCount,
      teams: teamCount,
      weeks,
      sessions: sessionIds.length,
      matches: matchRows.length,
      manage_url: `/player/leagues/${leagueId}/manage`,
      view_url: `/player/leagues/${leagueId}`,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message :
      typeof error === 'object' ? JSON.stringify(error) : String(error)
    console.error('simulate-league error:', message, error)
    return json({ error: message }, 500)
  }
})
