import { pathToFileURL } from "node:url";
import { PRODUCTION_SUPABASE_PROJECT } from "../src/lib/backendPolicy.mjs";

// Aggregate counts only: no player identities, scores, contacts or credentials leave the database.
export const matchIntegrityQuery = `WITH records AS (
 SELECT mp.player_id,count(DISTINCT m.id) AS played,
 count(DISTINCT m.id) FILTER(WHERE (mp.team=1 AND m.team1_score>m.team2_score) OR (mp.team=2 AND m.team2_score>m.team1_score)) AS won,
 sum(CASE WHEN mp.team=1 THEN m.team1_score ELSE m.team2_score END) AS points_for,
 sum(CASE WHEN mp.team=1 THEN m.team2_score ELSE m.team1_score END) AS points_against
 FROM public.match_participants mp JOIN public.matches m ON m.id=mp.match_id
 WHERE m.status='approved' AND NOT coalesce(m.voided,false) AND mp.player_id IS NOT NULL GROUP BY mp.player_id
 ), ratings AS (
 SELECT DISTINCT ON(mp.player_id) mp.player_id,mp.rating_after
 FROM public.match_participants mp JOIN public.matches m ON m.id=mp.match_id
 WHERE m.status='approved' AND NOT coalesce(m.voided,false) AND coalesce(m.count_for_rating,true)
 AND mp.rating_after IS NOT NULL AND mp.player_id IS NOT NULL
 ORDER BY mp.player_id,m.match_date DESC,m.created_at DESC,m.id DESC
 ) SELECT jsonb_build_object(
 'record_mismatches',count(*) FILTER(WHERE (coalesce(p.total_matches,0),coalesce(p.wins,0),coalesce(p.losses,0),coalesce(p.total_points_for,0),coalesce(p.total_points_against,0))
 IS DISTINCT FROM (coalesce(r.played,0),coalesce(r.won,0),coalesce(r.played-r.won,0),coalesce(r.points_for,0),coalesce(r.points_against,0))),
 'ranked_rating_mismatches',count(*) FILTER(WHERE abs(p.current_rating-coalesce(t.rating_after,p.initial_self_rating,3.00))>0.0001),
 'mismatches_with_ranked_history',count(*) FILTER(WHERE t.player_id IS NOT NULL AND abs(p.current_rating-t.rating_after)>0.0001),
 'mismatches_without_ranked_history',count(*) FILTER(WHERE t.player_id IS NULL AND abs(p.current_rating-coalesce(p.initial_self_rating,3.00))>0.0001),
 'mismatches_without_playing_record',count(*) FILTER(WHERE r.player_id IS NULL AND t.player_id IS NULL AND abs(p.current_rating-coalesce(p.initial_self_rating,3.00))>0.0001),
 'ranked_mismatches_with_tied_match_timestamps',count(*) FILTER(WHERE t.player_id IS NOT NULL AND abs(p.current_rating-t.rating_after)>0.0001 AND EXISTS(SELECT 1 FROM public.match_participants a JOIN public.matches x ON x.id=a.match_id JOIN public.match_participants b ON b.player_id=a.player_id AND b.match_id<>a.match_id JOIN public.matches y ON y.id=b.match_id WHERE a.player_id=p.id AND x.status='approved' AND y.status='approved' AND x.match_date=y.match_date AND x.created_at=y.created_at)),
 'mismatches_with_unranked_history',count(*) FILTER(WHERE abs(p.current_rating-coalesce(t.rating_after,p.initial_self_rating,3.00))>0.0001 AND EXISTS(SELECT 1 FROM public.match_participants mp JOIN public.matches m ON m.id=mp.match_id WHERE mp.player_id=p.id AND m.status='approved' AND NOT coalesce(m.voided,false) AND m.count_for_rating=false))
 ) AS checks FROM public.profiles p LEFT JOIN records r ON r.player_id=p.id LEFT JOIN ratings t ON t.player_id=p.id;`;

export async function checkMatchSystem(env = process.env, request = fetch) {
  if (
    env.SUPABASE_PROJECT_REF !== PRODUCTION_SUPABASE_PROJECT ||
    !env.SUPABASE_ACCESS_TOKEN?.startsWith("sbp_")
  )
    throw new Error(
      "Approved production project and deployment credential are required.",
    );
  const response = await request(
    `https://api.supabase.com/v1/projects/${PRODUCTION_SUPABASE_PROJECT}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: matchIntegrityQuery, read_only: true }),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw new Error(`Match integrity query failed (HTTP ${response.status}).`);
  const payload = await response.json();
  const checks = (Array.isArray(payload) ? payload : payload?.data)?.[0]
    ?.checks;
  if (
    !checks ||
    !["record_mismatches", "ranked_rating_mismatches"].every(
      (key) => Number.isInteger(checks[key]) && checks[key] >= 0,
    )
  )
    throw new Error("Match integrity results were incomplete.");
  return {
    integrityPassed: Object.values(checks).every((value) => value === 0),
    checks,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  checkMatchSystem()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.integrityPassed) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
