CREATE OR REPLACE FUNCTION public.get_player_recent_matches(
  _player_id uuid,
  _limit     integer DEFAULT 10
) RETURNS TABLE (
  match_id       uuid,
  match_date     date,
  team1_score    integer,
  team2_score    integer,
  status         text,
  source         text,
  verified_count integer,
  court_name     text,
  player_team    integer,
  rating_change  numeric,
  participants   jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    m.id,
    m.match_date,
    m.team1_score,
    m.team2_score,
    m.status::text,
    m.source::text,
    coalesce(array_length(m.verified_by, 1), 0) AS verified_count,
    coalesce(m.other_location, c.name)          AS court_name,
    mp_self.team                                 AS player_team,
    mp_self.rating_change,
    (
      SELECT jsonb_agg(jsonb_build_object(
               'player_id',    mp.player_id,
               'team',         mp.team,
               'display_name', pp.display_name,
               'full_name',    pp.full_name,
               'first_name',   pp.first_name,
               'last_name',    pp.last_name,
               'avatar_url',   pp.avatar_url))
      FROM public.match_participants mp
      LEFT JOIN public.profiles_public pp ON pp.id = mp.player_id
      WHERE mp.match_id = m.id
    ) AS participants
  FROM public.match_participants mp_self
  JOIN public.matches m       ON m.id = mp_self.match_id
  LEFT JOIN public.courts c   ON c.id = m.court_id
  WHERE mp_self.player_id = _player_id
    AND m.status = 'approved'
  ORDER BY m.created_at DESC
  LIMIT least(greatest(_limit, 1), 25);
$$;

REVOKE ALL ON FUNCTION public.get_player_recent_matches(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_recent_matches(uuid, integer) TO authenticated;