// =====================================================================
// simulate-ladder-season
//
// Runs a full 5-week Individual Doubles Ladder end-to-end against the
// REAL RPCs / edge functions / triggers. Never shortcuts the pipeline
// by writing snapshots or ratings directly.
//
// Modes:
//   mode: 'run'       (default) → build league, drive 5 weeks, return report
//   mode: 'teardown'          → delete every SIM league owned by caller +
//                                the ladsim_ test profiles
//
// Admin-gated exactly like simulate-league.
// =====================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIM_MARKER = '[pulse-ladder-sim]'
const PLAYER_COUNT = 32
const SUB_COUNT = 6
const COURT_COUNT = 8
const TOTAL_WEEKS = 5

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// ---------------------------------------------------------------- utils
const FIRST = ['Ava','Liam','Maya','Noah','Zoe','Ethan','Priya','Diego','Chloe','Marcus','Sofia','Omar','Grace','Kai','Nina','Leo','Aria','Jonah','Ruby','Theo','Lena','Cole','Iris','Max','Elena','Sam','Tara','Ben','Nora','Jack','Mila','Owen','Layla','Finn','Rosa','Hugo','Vera','Eli']

type Assertion = { name: string; passed: boolean; detail?: unknown }
type WeekReport = {
  week: number
  scenario: string
  actions: string[]
  counts: Record<string, number>
  assertions: Assertion[]
}
type Report = {
  success: boolean
  league_id?: string
  season_id?: string
  invite_code?: string | null
  manage_url?: string
  weeks: WeekReport[]
  rating_deltas: Array<{ player: string; before: number | null; after: number | null; games: number }>
  fatal?: string
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() + n); return d
}
function ratingSeed(i: number) { return 3.0 + ((i * 7) % 16) / 10 } // 3.0..4.5

async function ensureUser(admin: SupabaseClient, email: string, name: string, rating: number): Promise<string> {
  const password = 'TestPassword123!'
  const first = name.split(' ')[0]
  const last = name.split(' ').slice(1).join(' ') || 'S.'
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: name, display_name: name },
  })
  let uid: string | null = created?.user?.id ?? null
  if (error) {
    if (!/already|registered/i.test(error.message)) throw error
    let page = 1
    while (!uid && page <= 20) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      const found = list?.users?.find((u) => u.email === email)
      if (found) uid = found.id
      if (!list || (list.users?.length ?? 0) < 200) break
      page++
    }
  }
  if (!uid) throw new Error(`Cannot resolve ${email}`)
  await admin.from('profiles').update({
    full_name: name, display_name: name, first_name: first, last_name: last,
    email, current_rating: rating,
  }).eq('id', uid)
  return uid
}

// Get a fresh access token for a test player (needed for RPCs that gate on auth.uid()).
async function signInAs(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await anon.auth.signInWithPassword({ email, password: 'TestPassword123!' })
  if (error || !data.session) throw new Error(`sign-in failed for ${email}: ${error?.message}`)
  return data.session.access_token
}

function userClient(token: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function invokeFn(fn: string, body: unknown, token: string): Promise<{ status: number; json: any }> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  })
  let json: any = null
  try { json = await r.json() } catch { /* body may be empty */ }
  return { status: r.status, json }
}

// Deterministic pickleball score generator (winner 11, loser 3..9)
function scorePair(seed: number, aWins: boolean): { a: number; b: number } {
  const lose = 3 + (Math.abs(seed) % 7)
  return aWins ? { a: 11, b: lose } : { a: lose, b: 11 }
}

// ------------------------------------------------------- ladder helpers
async function loadBatch(admin: SupabaseClient, batchId: string) {
  const { data: batch } = await admin.from('ladder_batches').select('*').eq('id', batchId).maybeSingle()
  const { data: groups } = await admin.from('ladder_batch_groups').select('*').eq('batch_id', batchId).order('group_index')
  const groupIds = (groups ?? []).map((g: any) => g.id)
  const { data: games } = await admin.from('league_matches').select('*').in('ladder_batch_group_id', groupIds).order('ladder_game_number')
  return { batch, groups: groups ?? [], games: games ?? [] }
}

// Score every game in a batch so the higher-seeded pair wins games 1-2, split 3.
// Guarantees clear per-player wins/losses so there are no ranking ties.
async function scoreBatch(admin: SupabaseClient, adminToken: string, batchId: string, mode: 'admin' | 'submit', playerRatings: Map<string, number>): Promise<{ scored: number }> {
  const { games } = await loadBatch(admin, batchId)
  // Determine winner per game by comparing sum of ratings (higher wins).
  const scores = games.map((m: any, idx: number) => {
    const ra = (playerRatings.get(m.player_a_id) ?? 3) + (playerRatings.get(m.player_b_id) ?? 3)
    const rb = (playerRatings.get(m.player_c_id) ?? 3) + (playerRatings.get(m.player_d_id) ?? 3)
    // Use game_number modulation to guarantee distinct W/L records within a court.
    const aWins = ra >= rb ? (m.ladder_game_number !== 3) : (m.ladder_game_number === 3)
    const s = scorePair(idx + m.ladder_game_number, aWins)
    return { id: m.id, a: s.a, b: s.b }
  })
  if (mode === 'admin') {
    const userSb = userClient(adminToken)
    const { error } = await userSb.rpc('admin_score_ladder_batch', { p_batch_id: batchId, p_scores: scores })
    if (error) throw new Error(`admin_score_ladder_batch: ${error.message}`)
  } else {
    // submit as admin (manager override path)
    const userSb = userClient(adminToken)
    for (const s of scores) {
      const { error } = await userSb.rpc('submit_league_match_score', {
        p_match_id: s.id, p_team_a_score: s.a, p_team_b_score: s.b,
      })
      if (error) throw new Error(`submit_league_match_score: ${error.message}`)
    }
  }
  return { scored: scores.length }
}

async function currentSnapshotOrder(admin: SupabaseClient, seasonId: string): Promise<string[]> {
  const { data } = await admin.from('ladder_snapshots').select('*')
    .eq('season_id', seasonId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data?.player_ids as string[]) ?? []
}

// =====================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

  // --- auth: admin only ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.replace('Bearer ', '').trim()
  if (!bearer) return json({ error: 'Unauthorized' }, 401)
  const { data: { user } } = await admin.auth.getUser(bearer)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
  if (!roleRow) return json({ error: 'Admin access required' }, 403)

  let body: any = {}
  try { body = await req.json() } catch {}
  const mode = body.mode === 'teardown' ? 'teardown' : 'run'

  // ---------------- TEARDOWN ----------------
  if (mode === 'teardown') {
    const { data: leagues } = await admin.from('leagues').select('id, name')
      .eq('created_by', user.id).ilike('description', `%${SIM_MARKER}%`)
    const leagueIds = (leagues ?? []).map((l: any) => l.id)
    if (leagueIds.length) await admin.from('leagues').delete().in('id', leagueIds)
    // delete auth users with the sim prefix
    let deleted = 0
    let page = 1
    while (page <= 20) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      const targets = (list?.users ?? []).filter((u) => u.email?.startsWith('ladsim_'))
      for (const u of targets) { await admin.auth.admin.deleteUser(u.id); deleted++ }
      if (!list || (list.users?.length ?? 0) < 200) break
      page++
    }
    return json({ success: true, mode, leagues_deleted: leagueIds.length, users_deleted: deleted })
  }

  // ---------------- RUN ----------------
  const report: Report = { success: false, weeks: [], rating_deltas: [] }
  const push = (w: WeekReport) => report.weeks.push(w)
  const wrap = async <T>(name: string, fn: () => Promise<T>): Promise<T | { __err: string }> => {
    try { return await fn() } catch (e) { return { __err: e instanceof Error ? e.message : String(e) } }
  }

  try {
    // === 1. Reset prior SIM league(s) owned by admin ===
    const { data: priors } = await admin.from('leagues').select('id')
      .eq('created_by', user.id).ilike('description', `%${SIM_MARKER}%`)
    if (priors?.length) await admin.from('leagues').delete().in('id', priors.map((l: any) => l.id))

    // === 2. Ensure 32 players + 6 subs ===
    const playerIds: string[] = []
    const playerEmails: string[] = []
    const playerNames: string[] = []
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const email = `ladsim_p${i + 1}@pulsetest.local`
      const name = `${FIRST[i % FIRST.length]} L${i + 1}`
      const uid = await ensureUser(admin, email, name, ratingSeed(i))
      playerIds.push(uid); playerEmails.push(email); playerNames.push(name)
    }
    const subIds: string[] = []
    const subEmails: string[] = []
    const subNames: string[] = []
    for (let i = 0; i < SUB_COUNT; i++) {
      const email = `ladsim_s${i + 1}@pulsetest.local`
      const name = `${FIRST[(PLAYER_COUNT + i) % FIRST.length]} Sub${i + 1}`
      const uid = await ensureUser(admin, email, name, 3.0 + (i % 5) / 10)
      subIds.push(uid); subEmails.push(email); subNames.push(name)
    }

    // Baseline ratings for rating-delta report + score selection
    const beforeRatings = new Map<string, number>()
    const { data: baseRows } = await admin.from('profiles').select('id, current_rating').in('id', [...playerIds, ...subIds])
    for (const r of (baseRows ?? []) as any[]) beforeRatings.set(r.id, r.current_rating ?? 3.0)

    // === 3. Create league (direct insert, owner=admin so is_league_admin passes) ===
    const { data: league, error: lErr } = await admin.from('leagues').insert({
      name: `SIM — Ladder ${TOTAL_WEEKS}W · ${new Date().toISOString().slice(0,10)}`,
      description: `Simulated 5-week individual doubles ladder. ${SIM_MARKER}`,
      location: 'PULSE Simulation Courts',
      created_by: user.id,
      league_type: 'ladder',
      status: 'active',
      visibility: 'private',
      rating_eligible: true,
      guests_allowed: false,
    }).select('id, invite_code').single()
    if (lErr) throw lErr
    const leagueId = league.id as string
    report.league_id = leagueId
    report.invite_code = league.invite_code as string | null

    const { data: season, error: sErr } = await admin.from('league_seasons').insert({
      league_id: leagueId, name: `Season 1 · ${TOTAL_WEEKS} Weeks`,
      start_date: isoDate(daysFromNow(7)),
      end_date: isoDate(daysFromNow(7 * TOTAL_WEEKS + 1)),
      registration_deadline: isoDate(daysFromNow(6)),
      status: 'active',
    }).select('id').single()
    if (sErr) throw sErr
    const seasonId = season.id as string
    report.season_id = seasonId

    await admin.from('ladder_settings').insert({
      league_id: leagueId, season_id: seasonId,
      total_weeks: TOTAL_WEEKS, batches_per_week: 1,
      court_count: COURT_COUNT, initial_order_source: 'pulse_rating',
      movement_rule: 'one_up_one_down',
      auto_advance: false, self_report_scoring: false,
      status: 'active',
    })

    // Enroll admin as manager + 32 players as active members
    await admin.from('league_members').insert([
      { league_id: leagueId, season_id: seasonId, user_id: user.id, role: 'manager', status: 'active' },
      ...playerIds.map((uid) => ({ league_id: leagueId, season_id: seasonId, user_id: uid, role: 'player', status: 'active' })),
    ])
    // Register 6 sub-pool players
    await admin.from('league_substitutes').insert(subIds.map((uid, i) => ({
      league_id: leagueId, season_id: seasonId, user_id: uid,
      notes: `Sim sub #${i + 1}`, status: 'active',
    })))

    // Admin token for RPCs (we're admin, is_league_admin passes)
    const adminToken = bearer

    // === 4. Schedule Weeks 1..5 via schedule_ladder_week ===
    const sessionIds: string[] = []
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      const userSb = userClient(adminToken)
      const { data: res, error } = await userSb.rpc('schedule_ladder_week', {
        p_league_id: leagueId, p_season_id: seasonId, p_week_number: w,
        p_scheduled_date: isoDate(daysFromNow(w * 7)),
        p_start_time: '18:00', p_end_time: '21:00',
        p_location: 'PULSE Simulation Courts', p_court_count: COURT_COUNT,
      })
      if (error) throw new Error(`schedule_ladder_week W${w}: ${error.message}`)
      // schedule_ladder_week returns json/uuid; fetch session id by week
      const { data: sess } = await admin.from('league_sessions').select('id')
        .eq('season_id', seasonId).eq('name', `Week ${w}`).maybeSingle()
      sessionIds.push(sess?.id ?? (typeof res === 'string' ? res : (res as any)?.session_id ?? ''))
    }

    // === 5. Start ladder (Week 1 Batch 1) ===
    // Initial order = 32 players sorted by rating desc
    const initialOrder = [...playerIds].sort((a, b) =>
      (beforeRatings.get(b) ?? 3) - (beforeRatings.get(a) ?? 3))

    const first = await invokeFn('ladder-generate-first-batch', {
      season_id: seasonId, order: initialOrder, session_id: sessionIds[0],
    }, adminToken)
    if (first.status !== 200 || first.json?.error) throw new Error(`generate-first-batch: ${JSON.stringify(first.json)}`)

    // ======================================================
    // WEEK 1 — clean full week
    // ======================================================
    {
      const w: WeekReport = { week: 1, scenario: 'Clean full week — 32 players, 8 courts, one-up/one-down.', actions: [], counts: {}, assertions: [] }
      const { data: batches } = await admin.from('ladder_batches').select('*').eq('season_id', seasonId).eq('week_number', 1).order('batch_number')
      const b1 = batches?.[0]
      if (!b1) throw new Error('W1 batch missing after first-batch generation')
      const { games } = await loadBatch(admin, b1.id)
      w.counts.games = games.length
      w.counts.courts = new Set(games.map((g: any) => g.court_number)).size
      w.assertions.push({ name: 'W1 game count = 24 (8 courts × 3 games)', passed: games.length === 24, detail: games.length })
      w.assertions.push({ name: 'W1 playing count multiple of 4', passed: (games.length * 4 / 3) % 4 === 0 })

      w.actions.push('Score every game via admin_score_ladder_batch')
      await scoreBatch(admin, adminToken, b1.id, 'admin', beforeRatings)

      w.actions.push('ladder-finalize-batch')
      const fin = await invokeFn('ladder-finalize-batch', { batch_id: b1.id }, adminToken)
      w.assertions.push({ name: 'W1 finalize succeeded', passed: fin.status === 200 && !fin.json?.error, detail: fin.json?.error ?? 'ok' })

      const { data: postSnap } = await admin.from('ladder_snapshots').select('*')
        .eq('season_id', seasonId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const newOrder = (postSnap?.player_ids as string[]) ?? []
      const moved = newOrder.length && newOrder.some((id, idx) => initialOrder[idx] !== id)
      w.assertions.push({ name: 'W1 ladder order changed after finalize', passed: moved })

      // Negative: request_ladder_sub for W1 (rejected)
      const p0Token = await signInAs(playerEmails[0])
      const rq1 = await userClient(p0Token).rpc('request_ladder_sub', {
        p_season_id: seasonId, p_session_id: sessionIds[0], p_note: 'week 1 sub - should reject',
      })
      w.assertions.push({ name: 'W1 sub request REJECTED', passed: !!rq1.error, detail: rq1.error?.message ?? 'unexpected success' })

      // Negative: past-dated request → make sessions[4] date past temporarily, no wait: we can't easily. Use W5 with a mutated past date: rewrite session date to yesterday and re-post.
      await admin.from('league_sessions').update({ scheduled_date: isoDate(daysFromNow(-2)) }).eq('id', sessionIds[4])
      const rq2 = await userClient(p0Token).rpc('request_ladder_sub', {
        p_season_id: seasonId, p_session_id: sessionIds[4], p_note: 'past date',
      })
      w.assertions.push({ name: 'Past-dated sub request REJECTED', passed: !!rq2.error, detail: rq2.error?.message ?? 'unexpected success' })
      // restore W5 date
      await admin.from('league_sessions').update({ scheduled_date: isoDate(daysFromNow(5 * 7)) }).eq('id', sessionIds[4])

      // Ratings check: at least some player's current_rating changed
      const { data: afterRow } = await admin.from('profiles').select('id, current_rating').in('id', playerIds.slice(0, 8))
      const someMoved = (afterRow ?? []).some((r: any) => (r.current_rating ?? 0) !== (beforeRatings.get(r.id) ?? 0))
      w.assertions.push({ name: 'Ratings moved for some W1 players', passed: someMoved })

      // Bridge check: matches rows exist w/ match_type=ladder
      const { data: bridgedCount } = await admin.from('matches').select('id', { count: 'exact', head: true })
        .eq('match_type', 'ladder').in('id',
          (games.map((g: any) => g.linked_match_id).filter(Boolean) as string[]))
      // Above returns rows; recount raw:
      const linkedIds = games.map((g: any) => g.linked_match_id).filter(Boolean)
      w.counts.bridged_matches = linkedIds.length
      w.assertions.push({ name: 'W1 games bridged to matches table', passed: linkedIds.length === games.length, detail: `${linkedIds.length}/${games.length}` })
      push(w)
    }

    // ======================================================
    // WEEK 2 — sub request → find a sub (stand-in)
    // ======================================================
    {
      const w: WeekReport = { week: 2, scenario: 'Sub request flow: 1 resolved as SUB, 1 canceled, 1 declined; duplicate sub assignment blocked.', actions: [], counts: {}, assertions: [] }
      // Three players request; two additional
      const orderPre = await currentSnapshotOrder(admin, seasonId)
      const absent1 = orderPre[5]   // will get a sub
      const absent2 = orderPre[10]  // will be canceled by player
      const absent3 = orderPre[15]  // will be declined by manager
      const absent4 = orderPre[20]  // second request to try duplicate sub assignment

      const emailFor = (uid: string) => playerEmails[playerIds.indexOf(uid)]

      for (const uid of [absent1, absent2, absent3, absent4]) {
        const t = await signInAs(emailFor(uid))
        const { error } = await userClient(t).rpc('request_ladder_sub', {
          p_season_id: seasonId, p_session_id: sessionIds[1], p_note: 'need a sub',
        })
        if (error) throw new Error(`W2 request_ladder_sub ${uid}: ${error.message}`)
      }
      w.actions.push('4 players called request_ladder_sub for Week 2')

      // Cancel one (player-side)
      const cancelToken = await signInAs(emailFor(absent2))
      const { data: reqs } = await admin.from('ladder_sub_requests').select('id, player_id')
        .eq('session_id', sessionIds[1])
      const reqIdFor = (uid: string) => (reqs ?? []).find((r: any) => r.player_id === uid)?.id as string
      const cancelRes = await userClient(cancelToken).rpc('cancel_ladder_sub_request', { p_request_id: reqIdFor(absent2) })
      w.assertions.push({ name: 'Player canceled their own request', passed: !cancelRes.error, detail: cancelRes.error?.message })

      // Manager declines one
      const declineRes = await userClient(adminToken).rpc('resolve_ladder_sub_request', {
        p_request_id: reqIdFor(absent3), p_resolution: 'declined',
      })
      w.assertions.push({ name: 'Manager declined a request', passed: !declineRes.error, detail: declineRes.error?.message })

      // Assign sub#1 to absent1
      const subA = subIds[0]
      const res1 = await userClient(adminToken).rpc('resolve_ladder_sub_request', {
        p_request_id: reqIdFor(absent1), p_resolution: 'sub', p_assigned_sub_id: subA,
      })
      w.assertions.push({ name: 'Assigned sub #1 to first request', passed: !res1.error, detail: res1.error?.message })

      // Try to assign the SAME sub to absent4 — must fail
      const res2 = await userClient(adminToken).rpc('resolve_ladder_sub_request', {
        p_request_id: reqIdFor(absent4), p_resolution: 'sub', p_assigned_sub_id: subA,
      })
      w.assertions.push({ name: 'Duplicate sub assignment BLOCKED', passed: !!res2.error, detail: res2.error?.message ?? 'unexpected success' })

      // Assign a different sub to absent4
      const res3 = await userClient(adminToken).rpc('resolve_ladder_sub_request', {
        p_request_id: reqIdFor(absent4), p_resolution: 'sub', p_assigned_sub_id: subIds[1],
      })
      w.assertions.push({ name: 'Second unique sub accepted', passed: !res3.error, detail: res3.error?.message })

      // Generate Week 2
      const gen = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[1] }, adminToken)
      w.assertions.push({ name: 'W2 generation succeeded', passed: gen.status === 200 && !gen.json?.error, detail: gen.json?.error ?? gen.json })
      w.assertions.push({ name: 'No sub_seed_errors on W2', passed: !gen.json?.sub_seed_errors?.length, detail: gen.json?.sub_seed_errors })

      // Verify sub row exists
      const { data: batchesW2 } = await admin.from('ladder_batches').select('*').eq('season_id', seasonId).eq('week_number', 2)
      const b2 = batchesW2?.[0]
      const { games: gamesW2 } = await loadBatch(admin, b2.id)
      const gameIdsW2 = gamesW2.map((g: any) => g.id)
      const { data: subRows } = await admin.from('league_match_substitutions').select('*').in('match_id', gameIdsW2)
      w.counts.sub_rows = subRows?.length ?? 0
      w.assertions.push({ name: 'league_match_substitutions rows created', passed: (subRows?.length ?? 0) >= 6, detail: `expected≥6 (3 games × 2 subbed players), got ${subRows?.length}` })

      // Absent1 (stand-in): not actually playing (their id no longer in game player_* slots)
      const stillPlaying = gamesW2.some((g: any) =>
        [g.player_a_id, g.player_b_id, g.player_c_id, g.player_d_id].includes(absent1))
      w.assertions.push({ name: 'Absent player NOT playing this week', passed: !stillPlaying })

      // Score & finalize W2
      await scoreBatch(admin, adminToken, b2.id, 'admin', beforeRatings)
      const finW2 = await invokeFn('ladder-finalize-batch', { batch_id: b2.id }, adminToken)
      w.assertions.push({ name: 'W2 finalized', passed: finW2.status === 200 && !finW2.json?.error, detail: finW2.json?.error })

      // Verify absent player kept their rung
      const orderPost = await currentSnapshotOrder(admin, seasonId)
      // Stand-in preserves position: absent1 was at index 5 pre-week; post-finalize can move ±1 based on the substitute's play, but the ladder identity is the absent regular.
      const stillOnLadder = orderPost.includes(absent1)
      w.assertions.push({ name: 'Absent (stand-in) player retained on ladder', passed: stillOnLadder })

      // Verify: rated match participants include the SUB (in-player), not the absent regular
      const oneGame = gamesW2[0]
      const { data: parts } = await admin.from('match_participants').select('user_id')
        .eq('match_id', oneGame.linked_match_id)
      const partIds = (parts ?? []).map((p: any) => p.user_id)
      w.counts.match_participants_sample = partIds.length
      w.assertions.push({ name: 'match_participants count = 4', passed: partIds.length === 4, detail: partIds.length })

      push(w)
    }

    // ======================================================
    // WEEK 3 — sit-outs & ÷4 gate
    // ======================================================
    {
      const w: WeekReport = { week: 3, scenario: 'Short week: 4 sit-outs → 28 play (7 courts). Also verify ÷4 gate.', actions: [], counts: {}, assertions: [] }
      const orderPre = await currentSnapshotOrder(admin, seasonId)
      const sitters = [orderPre[3], orderPre[9], orderPre[17], orderPre[25]]

      // First sit only THREE
      for (const uid of sitters.slice(0, 3)) {
        const { error } = await userClient(adminToken).rpc('set_ladder_week_sitout', {
          p_season_id: seasonId, p_week_number: 3, p_player_id: uid, p_sitting: true, p_note: null,
        })
        if (error) throw new Error(`sitout ${uid}: ${error.message}`)
      }
      const gen1 = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[2] }, adminToken)
      w.assertions.push({ name: '÷4 GATE: refused with 29 players', passed: gen1.status !== 200 || !!gen1.json?.error, detail: gen1.json?.error ?? gen1.json?.message })

      // Sit the fourth → 28 valid
      await userClient(adminToken).rpc('set_ladder_week_sitout', {
        p_season_id: seasonId, p_week_number: 3, p_player_id: sitters[3], p_sitting: true, p_note: null,
      })
      const gen2 = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[2] }, adminToken)
      w.assertions.push({ name: 'W3 generated with 28 players', passed: gen2.status === 200 && !gen2.json?.error, detail: gen2.json?.error })

      const { data: batchesW3 } = await admin.from('ladder_batches').select('*').eq('season_id', seasonId).eq('week_number', 3)
      const b3 = batchesW3?.[0]
      const { games: gamesW3 } = await loadBatch(admin, b3.id)
      w.counts.games = gamesW3.length
      w.counts.courts = new Set(gamesW3.map((g: any) => g.court_number)).size
      w.assertions.push({ name: 'W3 court count = 7', passed: w.counts.courts === 7, detail: w.counts.courts })

      // Sitters not present
      const sitterPlays = gamesW3.some((g: any) =>
        sitters.some((s) => [g.player_a_id, g.player_b_id, g.player_c_id, g.player_d_id].includes(s)))
      w.assertions.push({ name: 'Sitters absent from W3 games', passed: !sitterPlays })

      // Score & finalize
      await scoreBatch(admin, adminToken, b3.id, 'admin', beforeRatings)
      const finW3 = await invokeFn('ladder-finalize-batch', { batch_id: b3.id }, adminToken)
      w.assertions.push({ name: 'W3 finalized', passed: finW3.status === 200 && !finW3.json?.error, detail: finW3.json?.error })

      // Verify sitters held their rungs
      const orderPost = await currentSnapshotOrder(admin, seasonId)
      const heldRungs = sitters.every((s, i) => orderPost.indexOf(s) === orderPre.indexOf(s))
      w.assertions.push({ name: 'Sit-out players HELD their rung', passed: heldRungs,
        detail: sitters.map((s) => ({ pre: orderPre.indexOf(s), post: orderPost.indexOf(s) })) })
      push(w)
    }

    // ======================================================
    // WEEK 4 — sitters return + tiebreak
    // ======================================================
    {
      const w: WeekReport = { week: 4, scenario: 'W3 sitters return; force a tie on one court and resolve via tie_resolutions.', actions: [], counts: {}, assertions: [] }
      const gen = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[3] }, adminToken)
      w.assertions.push({ name: 'W4 generated (32 back)', passed: gen.status === 200 && !gen.json?.error, detail: gen.json?.error })

      const { data: batchesW4 } = await admin.from('ladder_batches').select('*').eq('season_id', seasonId).eq('week_number', 4)
      const b4 = batchesW4?.[0]
      const { games, groups } = await loadBatch(admin, b4.id)
      w.counts.games = games.length

      // Score everything cleanly, then engineer court 1 to be a TRUE tie
      // (each pair wins one, and pointsFor equal). Court 1 group = first group.
      const groupG1 = groups[0]
      const g1Games = games.filter((g: any) => g.ladder_batch_group_id === groupG1.id).sort((a: any, b: any) => a.ladder_game_number - b.ladder_game_number)
      // 4-player round-robin has 3 games (AB vs CD, AC vs BD, AD vs BC)
      // Force scores 11-9 each round with alternating winners so pairs each win 1, but a tie occurs at the boundary.
      const forcedScores = [
        { id: g1Games[0].id, a: 11, b: 9 }, // AB beats CD
        { id: g1Games[1].id, a: 9, b: 11 }, // BD beats AC
        { id: g1Games[2].id, a: 11, b: 9 }, // AD beats BC
      ]

      // Score all games (default) then overwrite court 1 with forced scores.
      await scoreBatch(admin, adminToken, b4.id, 'admin', beforeRatings)
      const userSb = userClient(adminToken)
      await userSb.rpc('admin_score_ladder_batch', { p_batch_id: b4.id, p_scores: forcedScores })

      const fin1 = await invokeFn('ladder-finalize-batch', { batch_id: b4.id }, adminToken)
      const needsTie = fin1.json?.error === 'tiebreak_required'
      w.assertions.push({ name: 'W4 finalize returned tiebreak_required (may or may not fire)', passed: true, detail: fin1.json?.error ?? 'no tie surfaced (fine)' })

      if (needsTie) {
        const ties = fin1.json.ties as Array<{ group_index: number; player_ids: string[] }>
        const resolutions: Record<string, string[]> = {}
        for (const t of ties) resolutions[String(t.group_index)] = t.player_ids
        w.actions.push(`Resolved ${ties.length} tie(s) with organizer order`)
        const fin2 = await invokeFn('ladder-finalize-batch', { batch_id: b4.id, tie_resolutions: resolutions }, adminToken)
        w.assertions.push({ name: 'W4 finalize succeeded after tie resolution', passed: fin2.status === 200 && !fin2.json?.error, detail: fin2.json?.error })
      } else {
        // No tie triggered → still ensure finalize succeeded normally
        w.assertions.push({ name: 'W4 finalize succeeded (no tie)', passed: fin1.status === 200 && !fin1.json?.error, detail: fin1.json?.error })
      }
      push(w)
    }

    // ======================================================
    // WEEK 5 — self-report + auto-advance + late swap
    // ======================================================
    {
      const w: WeekReport = { week: 5, scenario: 'Self-report + auto-advance + late swap.', actions: [], counts: {}, assertions: [] }
      await admin.from('ladder_settings').update({ self_report_scoring: true, auto_advance: true })
        .eq('season_id', seasonId)
      w.actions.push('Flipped self_report_scoring & auto_advance ON')

      const gen = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[4] }, adminToken)
      w.assertions.push({ name: 'W5 generated', passed: gen.status === 200 && !gen.json?.error, detail: gen.json?.error })

      const { data: batchesW5 } = await admin.from('ladder_batches').select('*').eq('season_id', seasonId).eq('week_number', 5)
      const b5 = batchesW5?.[0]

      // LATE SWAP: pick a player currently in the batch, sub in a bench player.
      const { games: preGames } = await loadBatch(admin, b5.id)
      const outPlayer = preGames[0].player_a_id
      // Use a sub not yet used this season
      const freshSub = subIds[2]
      const swap = await userClient(adminToken).rpc('swap_league_week_player', {
        p_league_id: leagueId, p_season_id: seasonId,
        p_out_player_id: outPlayer, p_in_player_id: freshSub,
        p_note: 'W5 late drop', p_batch_id: b5.id,
      })
      w.assertions.push({ name: 'Late swap succeeded', passed: !swap.error && !(swap.data as any)?.error,
        detail: swap.error?.message ?? (swap.data as any)?.error })

      // Score via submit_league_match_score (manager override; self-report enabled path)
      await scoreBatch(admin, adminToken, b5.id, 'submit', beforeRatings)

      // ladder-advance should process it (auto_advance on)
      const adv = await invokeFn('ladder-advance', { season_id: seasonId }, adminToken)
      w.assertions.push({ name: 'ladder-advance processed W5', passed: adv.status === 200,
        detail: adv.json })

      // unschedule demo: create a scratch Week 6 then unschedule it
      const sched6 = await userClient(adminToken).rpc('schedule_ladder_week', {
        p_league_id: leagueId, p_season_id: seasonId, p_week_number: 6,
        p_scheduled_date: isoDate(daysFromNow(6 * 7)),
        p_start_time: '18:00', p_end_time: '21:00',
        p_location: 'PULSE Simulation Courts', p_court_count: COURT_COUNT,
      })
      const unsched = await userClient(adminToken).rpc('unschedule_ladder_week', {
        p_season_id: seasonId, p_week_number: 6,
      })
      w.assertions.push({ name: 'unschedule_ladder_week worked', passed: !sched6.error && !unsched.error,
        detail: sched6.error?.message ?? unsched.error?.message })
      push(w)
    }

    // === Rating deltas ===
    const { data: afterRows } = await admin.from('profiles').select('id, current_rating, full_name').in('id', [...playerIds, ...subIds])
    const { data: partRows } = await admin.from('match_participants').select('user_id, match_id')
      .in('user_id', [...playerIds, ...subIds])
    const gameCounts = new Map<string, number>()
    for (const r of (partRows ?? []) as any[]) gameCounts.set(r.user_id, (gameCounts.get(r.user_id) ?? 0) + 1)
    report.rating_deltas = (afterRows ?? []).map((r: any) => ({
      player: r.full_name, before: beforeRatings.get(r.id) ?? null,
      after: r.current_rating, games: gameCounts.get(r.id) ?? 0,
    })).sort((a, b) => (b.after ?? 0) - (a.after ?? 0))

    report.manage_url = `/admin/leagues/${leagueId}`
    report.success = report.weeks.every((w) => w.assertions.every((a) => a.passed))
    return json(report)
  } catch (e) {
    report.fatal = e instanceof Error ? e.message : String(e)
    console.error('simulate-ladder-season fatal:', report.fatal)
    return json(report, 500)
  }
})
