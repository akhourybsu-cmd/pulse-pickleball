// Read-only incident diagnostics. No credentials or player identities are logged.
const project = 'rqfqwavhtfwwtmfjnxkx';
if (process.env.SUPABASE_PROJECT_REF !== project || !process.env.SUPABASE_ACCESS_TOKEN?.startsWith('sbp_')) throw new Error('Production diagnostic configuration is missing.');
const query = `WITH target AS (
  SELECT * FROM public.round_robin_events WHERE id='771a98ee-ec99-4980-a5bd-51327254e201'::uuid
) SELECT jsonb_build_object(
  'id',e.id,'name',e.name,'date',e.date,'status',e.status,'voided',e.voided,
  'current_round',e.current_round,'num_rounds',e.num_rounds,'num_courts',e.num_courts,
  'organizer_can_manage',public.can_manage_round_robin(e.id,e.organizer_id),
  'players',(SELECT jsonb_agg(x) FROM (SELECT active,status,registration_status,count(*) AS count FROM round_robin_players WHERE event_id=e.id GROUP BY active,status,registration_status) x),
  'rounds',(SELECT jsonb_agg(x ORDER BY round_no) FROM (SELECT round_no,count(*) AS rows,
    count(*) FILTER(WHERE is_bye) AS byes,count(*) FILTER(WHERE abandoned) AS abandoned,
    count(*) FILTER(WHERE team1_score IS NOT NULL AND team2_score IS NOT NULL) AS scored,
    count(*) FILTER(WHERE match_id IS NOT NULL) AS linked,
    count(*) FILTER(WHERE NOT is_bye AND ((a1_player_id IS NULL AND a1_guest_id IS NULL) OR (a2_player_id IS NULL AND a2_guest_id IS NULL) OR (b1_player_id IS NULL AND b1_guest_id IS NULL) OR (b2_player_id IS NULL AND b2_guest_id IS NULL))) AS unfilled
    FROM round_robin_schedule WHERE event_id=e.id GROUP BY round_no) x),
  'audit',(SELECT jsonb_agg(x) FROM (SELECT change_type,created_at,
    changes->'from_round' AS from_round,changes->'round_no' AS round_no,
    (SELECT jsonb_agg(k) FROM jsonb_object_keys(changes) AS k) AS fields
    FROM round_robin_audit WHERE event_id=e.id ORDER BY created_at DESC LIMIT 15) x)
) AS event FROM target e;`;
const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query, read_only: true }), signal: AbortSignal.timeout(45000),
});
const body = await response.json();
if (!response.ok) throw new Error(`Read-only diagnostic failed (${response.status}): ${JSON.stringify(body)}`);
console.log(JSON.stringify(body, null, 2));
