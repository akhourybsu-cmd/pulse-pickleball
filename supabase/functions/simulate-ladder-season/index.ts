// =====================================================================
// simulate-ladder-season
//
// Runs a configurable Individual Doubles Ladder season end-to-end against
// the REAL RPCs / edge functions / triggers. Never shortcuts the pipeline
// by writing snapshots or ratings directly.
//
// Modes:
//   mode: 'run'      (default) → build league, drive N weeks, return report
//   mode: 'teardown'          → delete every SIM league owned by caller +
//                                the ladsim_ test profiles
//
// Body (run): { mode?: 'run', config?: SimConfig }
//   SimConfig (all optional; defaults reproduce the classic 5-week script):
//     playerCount   number  (>=8, coerced to a multiple of 4; default 32)
//     subCount      number  (0..16; default 6)
//     courtCount    number  (1..playerCount/4; default playerCount/4)
//     totalWeeks    number  (1..12; default 5)
//     seed          number  (varies ratings deterministically; default 12345)
//     ratingEligible boolean (default true)
//     selfReport    boolean  (season default; default false)
//     autoAdvance   boolean  (season default; default false)
//     weeks         WeekSpec[]  per-week scenario injections (see below)
//
//   WeekSpec { week; sitouts?; subRequests?; subResolutions?('sub'|'cancel'|
//     'decline')[]; forceTie?; dispute?; lateSwap?; selfReport?; autoAdvance? }
//
// Admin-gated exactly like simulate-league.
// =====================================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIM_MARKER = '[pulse-ladder-sim]'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const FIRST = ['Ava','Liam','Maya','Noah','Zoe','Ethan','Priya','Diego','Chloe','Marcus','Sofia','Omar','Grace','Kai','Nina','Leo','Aria','Jonah','Ruby','Theo','Lena','Cole','Iris','Max','Elena','Sam','Tara','Ben','Nora','Jack','Mila','Owen','Layla','Finn','Rosa','Hugo','Vera','Eli','Cleo','Reid','Dax','Wren','Beau','Isla','Cyrus','Nova','Rhys','Tessa']

// ---------------------------------------------------------------- types
type Resolution = 'sub' | 'cancel' | 'decline'
type WeekSpec = {
  week: number
  sitouts?: number
  subRequests?: number
  subResolutions?: Resolution[]
  forceTie?: boolean
  dispute?: boolean
  lateSwap?: boolean
  selfReport?: boolean
  autoAdvance?: boolean
}
type SimConfig = {
  playerCount: number
  subCount: number
  courtCount: number
  totalWeeks: number
  seed: number
  ratingEligible: boolean
  selfReport: boolean
  autoAdvance: boolean
  weeks: WeekSpec[]
}
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
  config?: Partial<SimConfig>
  league_id?: string
  season_id?: string
  invite_code?: string | null
  manage_url?: string
  weeks: WeekReport[]
  rating_deltas: Array<{ player: string; before: number | null; after: number | null; games: number }>
  fatal?: string
}

// ---------------------------------------------------------------- utils
function isoDate(d: Date) { return d.toISOString().slice(0, 10) }
function daysFromNow(n: number): Date {
  const d = new Date()
  d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate() + n); return d
}
// Small seeded PRNG so a given seed reproduces the same season.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return dflt
  return Math.max(lo, Math.min(hi, n))
}
// Pick `count` distinct indices spread across [0, n), skipping `avoid`.
function spreadIndices(n: number, count: number, avoid: Set<number>): number[] {
  const out: number[] = []
  if (count <= 0 || n <= 0) return out
  const step = Math.max(1, Math.floor(n / count))
  let i = 0
  while (out.length < count && i < n * 2) {
    const idx = (out.length * step + Math.floor(step / 2)) % n
    if (!avoid.has(idx) && !out.includes(idx)) out.push(idx)
    else {
      // linear probe for the next free index
      let p = idx
      let guard = 0
      while ((avoid.has(p) || out.includes(p)) && guard < n) { p = (p + 1) % n; guard++ }
      if (!avoid.has(p) && !out.includes(p)) out.push(p)
    }
    i++
  }
  return out
}

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

// Score every game in a batch; higher summed-rating pair wins games 1-2,
// splits game 3, so per-player records are (usually) distinct.
async function scoreBatch(admin: SupabaseClient, adminToken: string, batchId: string, mode: 'admin' | 'submit', playerRatings: Map<string, number>): Promise<{ scored: number }> {
  const { games } = await loadBatch(admin, batchId)
  const scores = games.map((m: any, idx: number) => {
    const ra = (playerRatings.get(m.player_a_id) ?? 3) + (playerRatings.get(m.player_b_id) ?? 3)
    const rb = (playerRatings.get(m.player_c_id) ?? 3) + (playerRatings.get(m.player_d_id) ?? 3)
    const aWins = ra >= rb ? (m.ladder_game_number !== 3) : (m.ladder_game_number === 3)
    const s = scorePair(idx + m.ladder_game_number, aWins)
    return { id: m.id, a: s.a, b: s.b }
  })
  const userSb = userClient(adminToken)
  if (mode === 'admin') {
    const { error } = await userSb.rpc('admin_score_ladder_batch', { p_batch_id: batchId, p_scores: scores })
    if (error) throw new Error(`admin_score_ladder_batch: ${error.message}`)
  } else {
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

// ---------------------------------------------------------------- config
function defaultWeeks(total: number): WeekSpec[] {
  const arr: WeekSpec[] = []
  for (let w = 1; w <= total; w++) {
    if (w === 1) arr.push({ week: 1 })
    else if (w === 2) arr.push({ week: 2, subRequests: 4, subResolutions: ['sub', 'cancel', 'decline', 'sub'] })
    else if (w === 3) arr.push({ week: 3, sitouts: 4 })
    else if (w === 4) arr.push({ week: 4, forceTie: true })
    else if (w === 5) arr.push({ week: 5, selfReport: true, autoAdvance: true, lateSwap: true })
    else arr.push({ week: w })
  }
  return arr
}

function parseConfig(raw: any): SimConfig {
  const c = (raw && typeof raw === 'object') ? raw : {}
  let playerCount = clampInt(c.playerCount, 8, 64, 32)
  playerCount = Math.max(8, Math.floor(playerCount / 4) * 4) // multiple of 4
  const maxCourts = playerCount / 4
  const totalWeeks = clampInt(c.totalWeeks, 1, 12, 5)
  const cfg: SimConfig = {
    playerCount,
    subCount: clampInt(c.subCount, 0, 16, 6),
    courtCount: clampInt(c.courtCount, 1, maxCourts, maxCourts),
    totalWeeks,
    seed: Number.isFinite(Number(c.seed)) ? Math.round(Number(c.seed)) : 12345,
    ratingEligible: c.ratingEligible !== false,
    selfReport: c.selfReport === true,
    autoAdvance: c.autoAdvance === true,
    weeks: [],
  }
  // Per-week specs: caller overrides win, else the classic script; always
  // clamped to totalWeeks and filled so every week has a spec.
  const provided: Record<number, WeekSpec> = {}
  if (Array.isArray(c.weeks)) {
    for (const w of c.weeks) {
      if (w && Number.isFinite(Number(w.week))) provided[Math.round(Number(w.week))] = w
    }
  }
  const base = defaultWeeks(totalWeeks)
  cfg.weeks = base.map((d) => {
    const o = provided[d.week]
    if (!o) return Object.keys(provided).length ? { week: d.week } : d
    return {
      week: d.week,
      sitouts: o.sitouts != null ? clampInt(o.sitouts, 0, playerCount - 4, 0) : undefined,
      subRequests: o.subRequests != null ? clampInt(o.subRequests, 0, Math.min(12, playerCount - 4), 0) : undefined,
      subResolutions: Array.isArray(o.subResolutions) ? o.subResolutions.filter((r: any) => ['sub','cancel','decline'].includes(r)) : undefined,
      forceTie: o.forceTie === true,
      dispute: o.dispute === true,
      lateSwap: o.lateSwap === true,
      selfReport: typeof o.selfReport === 'boolean' ? o.selfReport : undefined,
      autoAdvance: typeof o.autoAdvance === 'boolean' ? o.autoAdvance : undefined,
    }
  })
  return cfg
}

function describeWeek(s: WeekSpec): string {
  const parts: string[] = []
  if (s.sitouts) parts.push(`${s.sitouts} sit-out(s)`)
  if (s.subRequests) parts.push(`${s.subRequests} sub request(s)`)
  if (s.forceTie) parts.push('forced tiebreak')
  if (s.dispute) parts.push('score dispute/correction')
  if (s.lateSwap) parts.push('late swap')
  if (s.selfReport) parts.push('self-report')
  if (s.autoAdvance) parts.push('auto-advance')
  return parts.length ? parts.join(', ') : 'clean week'
}

// =====================================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

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
    const { data: leagues } = await admin.from('leagues').select('id')
      .eq('created_by', user.id).ilike('description', `%${SIM_MARKER}%`)
    const leagueIds = (leagues ?? []).map((l: any) => l.id)
    if (leagueIds.length) await admin.from('leagues').delete().in('id', leagueIds)
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
  const cfg = parseConfig(body.config)
  const report: Report = {
    success: false, weeks: [], rating_deltas: [],
    config: {
      playerCount: cfg.playerCount, subCount: cfg.subCount, courtCount: cfg.courtCount,
      totalWeeks: cfg.totalWeeks, seed: cfg.seed, ratingEligible: cfg.ratingEligible,
      selfReport: cfg.selfReport, autoAdvance: cfg.autoAdvance,
    },
  }
  const rng = mulberry32(cfg.seed)

  try {
    // === 1. Reset prior SIM league(s) owned by admin ===
    const { data: priors } = await admin.from('leagues').select('id')
      .eq('created_by', user.id).ilike('description', `%${SIM_MARKER}%`)
    if (priors?.length) await admin.from('leagues').delete().in('id', priors.map((l: any) => l.id))

    // === 2. Ensure players + subs ===
    const playerIds: string[] = []
    const playerEmails: string[] = []
    for (let i = 0; i < cfg.playerCount; i++) {
      const email = `ladsim_p${i + 1}@pulsetest.local`
      const name = `${FIRST[i % FIRST.length]} L${i + 1}`
      const rating = 3.0 + Math.floor(rng() * 16) / 10 // 3.0..4.5, seed-varied
      const uid = await ensureUser(admin, email, name, rating)
      playerIds.push(uid); playerEmails.push(email)
    }
    const subIds: string[] = []
    for (let i = 0; i < cfg.subCount; i++) {
      const email = `ladsim_s${i + 1}@pulsetest.local`
      const name = `${FIRST[(cfg.playerCount + i) % FIRST.length]} Sub${i + 1}`
      const uid = await ensureUser(admin, email, name, 3.0 + Math.floor(rng() * 16) / 10)
      subIds.push(uid)
    }
    const emailFor = (uid: string) => playerEmails[playerIds.indexOf(uid)]

    const beforeRatings = new Map<string, number>()
    const { data: baseRows } = await admin.from('profiles').select('id, current_rating').in('id', [...playerIds, ...subIds])
    for (const r of (baseRows ?? []) as any[]) beforeRatings.set(r.id, r.current_rating ?? 3.0)

    // === 3. League + season + settings + roster (direct insert; owner=admin) ===
    const { data: league, error: lErr } = await admin.from('leagues').insert({
      name: `SIM — Ladder ${cfg.totalWeeks}W · ${new Date().toISOString().slice(0,10)}`,
      description: `Simulated individual doubles ladder. ${SIM_MARKER}`,
      location: 'PULSE Simulation Courts',
      created_by: user.id, league_type: 'ladder', status: 'active',
      visibility: 'private', rating_eligible: cfg.ratingEligible, guests_allowed: false,
    }).select('id, invite_code').single()
    if (lErr) throw lErr
    const leagueId = league.id as string
    report.league_id = leagueId
    report.invite_code = league.invite_code as string | null

    const { data: season, error: sErr } = await admin.from('league_seasons').insert({
      league_id: leagueId, name: `Season 1 · ${cfg.totalWeeks} Weeks`,
      start_date: isoDate(daysFromNow(7)),
      end_date: isoDate(daysFromNow(7 * cfg.totalWeeks + 1)),
      registration_deadline: isoDate(daysFromNow(6)), status: 'active',
    }).select('id').single()
    if (sErr) throw sErr
    const seasonId = season.id as string
    report.season_id = seasonId

    await admin.from('ladder_settings').insert({
      league_id: leagueId, season_id: seasonId,
      total_weeks: cfg.totalWeeks, batches_per_week: 1,
      court_count: cfg.courtCount, initial_order_source: 'pulse_rating',
      movement_rule: 'one_up_one_down',
      auto_advance: cfg.autoAdvance, self_report_scoring: cfg.selfReport, status: 'active',
    })

    await admin.from('league_members').insert([
      { league_id: leagueId, season_id: seasonId, user_id: user.id, role: 'manager', status: 'active' },
      ...playerIds.map((uid) => ({ league_id: leagueId, season_id: seasonId, user_id: uid, role: 'player', status: 'active' })),
    ])
    if (subIds.length) {
      await admin.from('league_substitutes').insert(subIds.map((uid, i) => ({
        league_id: leagueId, season_id: seasonId, user_id: uid, notes: `Sim sub #${i + 1}`, status: 'active',
      })))
    }

    const adminToken = bearer

    // === 4. Schedule weeks 1..N ===
    const sessionIds: string[] = []
    for (let w = 1; w <= cfg.totalWeeks; w++) {
      const { data: res, error } = await userClient(adminToken).rpc('schedule_ladder_week', {
        p_league_id: leagueId, p_season_id: seasonId, p_week_number: w,
        p_scheduled_date: isoDate(daysFromNow(w * 7)),
        p_start_time: '18:00', p_end_time: '21:00',
        p_location: 'PULSE Simulation Courts', p_court_count: cfg.courtCount,
      })
      if (error) throw new Error(`schedule_ladder_week W${w}: ${error.message}`)
      let sid = (res as any)?.session_id ?? (typeof res === 'string' ? res : '')
      if (!sid) {
        const { data: sess } = await admin.from('league_sessions').select('id')
          .eq('season_id', seasonId).eq('week_number', w).maybeSingle()
        sid = sess?.id ?? ''
      }
      if (!sid) throw new Error(`schedule_ladder_week W${w}: no session id`)
      sessionIds.push(sid)
    }

    // === 5. Start ladder (Week 1 Batch 1) ===
    const initialOrder = [...playerIds].sort((a, b) => (beforeRatings.get(b) ?? 3) - (beforeRatings.get(a) ?? 3))
    const first = await invokeFn('ladder-generate-first-batch', {
      season_id: seasonId, order: initialOrder, session_id: sessionIds[0],
    }, adminToken)
    if (first.status !== 200 || first.json?.error) throw new Error(`generate-first-batch: ${JSON.stringify(first.json)}`)

    const batchIdForWeek = async (wk: number): Promise<string> => {
      const { data } = await admin.from('ladder_batches').select('id')
        .eq('season_id', seasonId).eq('week_number', wk).order('batch_number').limit(1).maybeSingle()
      if (!data?.id) throw new Error(`No batch for week ${wk}`)
      return data.id as string
    }

    const push = (w: WeekReport) => report.weeks.push(w)

    // ---------- per-week runner ----------
    const runWeek = async (spec: WeekSpec): Promise<void> => {
      const wk = spec.week
      const w: WeekReport = { week: wk, scenario: describeWeek(spec), actions: [], counts: {}, assertions: [] }

      // Per-week setting toggles (apply before generate/score).
      if (spec.selfReport !== undefined || spec.autoAdvance !== undefined) {
        const upd: Record<string, boolean> = {}
        if (spec.selfReport !== undefined) upd.self_report_scoring = spec.selfReport
        if (spec.autoAdvance !== undefined) upd.auto_advance = spec.autoAdvance
        await admin.from('ladder_settings').update(upd).eq('season_id', seasonId)
        w.actions.push(`Settings: ${JSON.stringify(upd)}`)
      }

      let sitters: string[] = []

      // ---- pre-generation injections (week >= 2 only) ----
      if (wk >= 2) {
        const orderPre = await currentSnapshotOrder(admin, seasonId)
        const avoid = new Set<number>()

        // Sit-outs (+ ÷4 gate demonstration when the count isn't a multiple of 4).
        if (spec.sitouts && spec.sitouts > 0) {
          const n = Math.min(spec.sitouts, orderPre.length - 4)
          const idxs = spreadIndices(orderPre.length, n, avoid)
          idxs.forEach((i) => avoid.add(i))
          const chosen = idxs.map((i) => orderPre[i])
          for (const uid of chosen) {
            const { error } = await userClient(adminToken).rpc('set_ladder_week_sitout', {
              p_season_id: seasonId, p_week_number: wk, p_player_id: uid, p_sitting: true, p_note: null,
            })
            if (error) throw new Error(`sitout ${uid}: ${error.message}`)
          }
          w.actions.push(`Sat out ${chosen.length} player(s)`)
          const present = orderPre.length - chosen.length
          if (present % 4 !== 0) {
            const gBad = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[wk - 1] }, adminToken)
            w.assertions.push({ name: `÷4 gate refused with ${present} players`, passed: gBad.status !== 200 || !!gBad.json?.error, detail: gBad.json?.error ?? gBad.json?.message })
            const toUnsit = present % 4 === 0 ? 0 : (chosen.length % 4)
            for (let k = 0; k < toUnsit; k++) {
              await userClient(adminToken).rpc('set_ladder_week_sitout', {
                p_season_id: seasonId, p_week_number: wk, p_player_id: chosen[k], p_sitting: false, p_note: null,
              })
            }
            sitters = chosen.slice(toUnsit)
            w.actions.push(`Un-sat ${toUnsit} to reach a multiple of four`)
          } else {
            sitters = chosen
          }
        }

        // Sub requests + resolutions.
        if (spec.subRequests && spec.subRequests > 0) {
          const n = Math.min(spec.subRequests, orderPre.length - 4)
          const idxs = spreadIndices(orderPre.length, n, avoid)
          const requesters = idxs.map((i) => orderPre[i])
          for (const uid of requesters) {
            const t = await signInAs(emailFor(uid))
            const { error } = await userClient(t).rpc('request_ladder_sub', {
              p_season_id: seasonId, p_session_id: sessionIds[wk - 1], p_note: 'sim: need a sub',
            })
            if (error) throw new Error(`request_ladder_sub ${uid}: ${error.message}`)
          }
          w.actions.push(`${requesters.length} sub request(s)`)

          const { data: reqs } = await admin.from('ladder_sub_requests').select('id, player_id').eq('session_id', sessionIds[wk - 1])
          const reqIdFor = (uid: string) => (reqs ?? []).find((r: any) => r.player_id === uid)?.id as string
          const resolutions = spec.subResolutions?.length ? spec.subResolutions : (['sub'] as Resolution[])
          // Bench subs not already on the ladder this week.
          let benchPtr = 0
          const usedSub = new Set<string>()
          let dupTested = false
          for (let i = 0; i < requesters.length; i++) {
            const uid = requesters[i]
            const reqId = reqIdFor(uid)
            if (!reqId) continue
            const res = resolutions[i % resolutions.length]
            if (res === 'cancel') {
              const t = await signInAs(emailFor(uid))
              const r = await userClient(t).rpc('cancel_ladder_sub_request', { p_request_id: reqId })
              w.assertions.push({ name: `Request ${i + 1} canceled by player`, passed: !r.error, detail: r.error?.message })
            } else if (res === 'decline') {
              const r = await userClient(adminToken).rpc('resolve_ladder_sub_request', { p_request_id: reqId, p_resolution: 'declined' })
              w.assertions.push({ name: `Request ${i + 1} declined by manager`, passed: !r.error, detail: r.error?.message })
            } else {
              const subUid = subIds[benchPtr++]
              if (!subUid) {
                const r = await userClient(adminToken).rpc('resolve_ladder_sub_request', { p_request_id: reqId, p_resolution: 'declined' })
                w.assertions.push({ name: `Request ${i + 1}: no bench sub left → declined`, passed: !r.error, detail: 'sub pool exhausted' })
                continue
              }
              // Once, prove the same sub can't cover two players.
              if (!dupTested && usedSub.size > 0) {
                const prev = [...usedSub][0]
                const dup = await userClient(adminToken).rpc('resolve_ladder_sub_request', { p_request_id: reqId, p_resolution: 'sub', p_assigned_sub_id: prev })
                w.assertions.push({ name: 'Duplicate sub assignment blocked', passed: !!dup.error, detail: dup.error?.message ?? 'unexpected success' })
                dupTested = true
              }
              const r = await userClient(adminToken).rpc('resolve_ladder_sub_request', { p_request_id: reqId, p_resolution: 'sub', p_assigned_sub_id: subUid })
              w.assertions.push({ name: `Request ${i + 1} assigned a sub`, passed: !r.error, detail: r.error?.message })
              if (!r.error) usedSub.add(subUid)
            }
          }
        }
      }

      // ---- generation ----
      let batchId: string
      if (wk === 1) {
        batchId = await batchIdForWeek(1)
      } else {
        const gen = await invokeFn('ladder-generate-next', { season_id: seasonId, session_id: sessionIds[wk - 1] }, adminToken)
        w.assertions.push({ name: `W${wk} generated`, passed: gen.status === 200 && !gen.json?.error, detail: gen.json?.error ?? undefined })
        if (gen.json?.sub_seed_errors?.length) {
          w.assertions.push({ name: `W${wk} no sub-seed errors`, passed: false, detail: gen.json.sub_seed_errors })
        }
        if (gen.status !== 200 || gen.json?.error) { push(w); return }
        batchId = await batchIdForWeek(wk)
      }

      const { games: gen0, groups } = await loadBatch(admin, batchId)
      w.counts.games = gen0.length
      w.counts.courts = new Set(gen0.map((g: any) => g.court_number)).size

      // ---- late swap ----
      if (spec.lateSwap) {
        const inGame = new Set<string>()
        gen0.forEach((g: any) => [g.player_a_id, g.player_b_id, g.player_c_id, g.player_d_id].forEach((p) => p && inGame.add(p)))
        const freshSub = subIds.find((s) => !inGame.has(s))
        if (freshSub) {
          const outPlayer = gen0[0].player_a_id
          const swap = await userClient(adminToken).rpc('swap_league_week_player', {
            p_league_id: leagueId, p_season_id: seasonId,
            p_out_player_id: outPlayer, p_in_player_id: freshSub, p_note: 'sim late drop', p_batch_id: batchId,
          })
          w.assertions.push({ name: 'Late swap succeeded', passed: !swap.error && !(swap.data as any)?.error, detail: swap.error?.message ?? (swap.data as any)?.error })
        } else {
          w.assertions.push({ name: 'Late swap skipped (no free bench sub)', passed: true })
        }
      }

      // ---- scoring ----
      const { data: setNow } = await admin.from('ladder_settings').select('self_report_scoring').eq('season_id', seasonId).maybeSingle()
      const scoreMode: 'admin' | 'submit' = setNow?.self_report_scoring ? 'submit' : 'admin'

      const canForceTie = !!spec.forceTie && groups.length >= 3
      if (spec.forceTie && !canForceTie) w.assertions.push({ name: 'Forced tie skipped (need ≥3 groups)', passed: true, detail: `${groups.length} groups` })

      await scoreBatch(admin, adminToken, batchId, scoreMode, beforeRatings)

      if (canForceTie) {
        const tieGroup = groups[1]
        const tGames = gen0.filter((g: any) => g.ladder_batch_group_id === tieGroup.id).sort((a: any, b: any) => a.ladder_game_number - b.ladder_game_number)
        const forced = [
          { id: tGames[0].id, a: 11, b: 9 },
          { id: tGames[1].id, a: 11, b: 9 },
          { id: tGames[2].id, a: 9, b: 11 },
        ]
        const { error } = await userClient(adminToken).rpc('admin_score_ladder_batch', { p_batch_id: batchId, p_scores: forced })
        if (error) throw new Error(`force tie: ${error.message}`)
        w.actions.push('Forced a 3-way promotion tie on group index 1')
      }

      // ---- score dispute / correction ----
      if (spec.dispute) {
        const g = gen0[0]
        const corr = await userClient(adminToken).rpc('submit_league_match_score', { p_match_id: g.id, p_team_a_score: 11, p_team_b_score: 7 })
        w.assertions.push({ name: 'Score correction re-submitted', passed: !corr.error, detail: corr.error?.message })
      }

      // ---- finalize / advance ----
      if (spec.autoAdvance) {
        const adv = await invokeFn('ladder-advance', { season_id: seasonId }, adminToken)
        w.assertions.push({ name: `W${wk} auto-advance processed (advanced=true)`, passed: adv.status === 200 && adv.json?.advanced === true, detail: adv.json })
        const { data: bAfter } = await admin.from('ladder_batches').select('status').eq('id', batchId).maybeSingle()
        w.assertions.push({ name: `W${wk} batch finalized`, passed: bAfter?.status === 'finalized', detail: bAfter?.status })
      } else {
        const fin1 = await invokeFn('ladder-finalize-batch', { batch_id: batchId }, adminToken)
        if (canForceTie) {
          const needsTie = fin1.json?.error === 'tiebreak_required'
          w.assertions.push({ name: `W${wk} finalize required a tiebreak`, passed: needsTie, detail: fin1.json?.error ?? fin1.json })
          if (needsTie) {
            const resolutions: Record<string, string[]> = {}
            for (const t of (fin1.json.ties as any[])) resolutions[String(t.group_index)] = t.player_ids
            const fin2 = await invokeFn('ladder-finalize-batch', { batch_id: batchId, tie_resolutions: resolutions }, adminToken)
            w.assertions.push({ name: `W${wk} finalized after tie resolution`, passed: fin2.status === 200 && !fin2.json?.error, detail: fin2.json?.error })
          }
        } else {
          w.assertions.push({ name: `W${wk} finalized`, passed: fin1.status === 200 && !fin1.json?.error, detail: fin1.json?.error })
        }
      }

      // ---- common post-week checks ----
      const { games: after } = await loadBatch(admin, batchId)
      if (cfg.ratingEligible) {
        const linked = after.map((g: any) => g.linked_match_id).filter(Boolean) as string[]
        w.counts.bridged_matches = linked.length
        w.assertions.push({ name: `W${wk} games bridged to matches`, passed: linked.length === after.length, detail: `${linked.length}/${after.length}` })
      }
      // Sitters held their rung: compare the two newest snapshots (this
      // week's result vs the week's start order).
      if (sitters.length) {
        const { data: snaps } = await admin.from('ladder_snapshots').select('player_ids')
          .eq('season_id', seasonId).order('created_at', { ascending: false }).limit(2)
        const orderPost = ((snaps?.[0]?.player_ids as string[]) ?? [])
        const preOrder = ((snaps?.[1]?.player_ids as string[]) ?? [])
        const held = sitters.every((s) => preOrder.indexOf(s) === orderPost.indexOf(s))
        w.assertions.push({ name: 'Sit-out players held their rung', passed: held })
      }
      push(w)
    }

    // Run each configured week in order.
    for (const spec of cfg.weeks) {
      await runWeek(spec)
    }

    // === Rating deltas ===
    const { data: afterRows } = await admin.from('profiles').select('id, current_rating, full_name').in('id', [...playerIds, ...subIds])
    const { data: partRows } = await admin.from('match_participants').select('player_id, match_id').in('player_id', [...playerIds, ...subIds])
    const gameCounts = new Map<string, number>()
    for (const r of (partRows ?? []) as any[]) gameCounts.set(r.player_id, (gameCounts.get(r.player_id) ?? 0) + 1)
    report.rating_deltas = (afterRows ?? []).map((r: any) => ({
      player: r.full_name, before: beforeRatings.get(r.id) ?? null, after: r.current_rating, games: gameCounts.get(r.id) ?? 0,
    })).sort((a, b) => (b.after ?? 0) - (a.after ?? 0))

    report.manage_url = `/player/leagues/${leagueId}/manage`
    report.success = report.weeks.every((wk) => wk.assertions.every((a) => a.passed))
    return json(report)
  } catch (e) {
    report.fatal = e instanceof Error ? e.message : String(e)
    console.error('simulate-ladder-season fatal:', report.fatal)
    return json(report, 500)
  }
})
