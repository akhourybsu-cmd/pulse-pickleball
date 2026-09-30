BEGIN;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS city text CHECK (length(city)<=80), ADD COLUMN IF NOT EXISTS state text CHECK (length(state)<=80);
CREATE FUNCTION public.community_region(p_value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce((SELECT code FROM (VALUES
('al','alabama'),
('ak','alaska'),
('az','arizona'),
('ar','arkansas'),
('ca','california'),
('co','colorado'),
('ct','connecticut'),
('de','delaware'),
('dc','district of columbia'),
('fl','florida'),
('ga','georgia'),
('hi','hawaii'),
('id','idaho'),
('il','illinois'),
('in','indiana'),
('ia','iowa'),
('ks','kansas'),
('ky','kentucky'),
('la','louisiana'),
('me','maine'),
('md','maryland'),
('ma','massachusetts'),
('mi','michigan'),
('mn','minnesota'),
('ms','mississippi'),
('mo','missouri'),
('mt','montana'),
('ne','nebraska'),
('nv','nevada'),
('nh','new hampshire'),
('nj','new jersey'),
('nm','new mexico'),
('ny','new york'),
('nc','north carolina'),
('nd','north dakota'),
('oh','ohio'),
('ok','oklahoma'),
('or','oregon'),
('pa','pennsylvania'),
('ri','rhode island'),
('sc','south carolina'),
('sd','south dakota'),
('tn','tennessee'),
('tx','texas'),
('ut','utah'),
('vt','vermont'),
('va','virginia'),
('wa','washington'),
('wv','west virginia'),
('wi','wisconsin'),
('wy','wyoming')
 ) AS regions(code,name) WHERE lower(trim(p_value)) IN (code,name) LIMIT 1),lower(trim(coalesce(p_value,''))))
$$;
-- Public directory projection deliberately excludes membership, invite codes and settings.
CREATE FUNCTION public.discover_communities(p_search text DEFAULT '',p_city text DEFAULT '',p_state text DEFAULT '',p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH candidates AS (
  SELECT g.id,g.name,g.type,g.member_count,g.is_venue_verified,
   coalesce(nullif(trim(v.city),''),nullif(trim(g.city),''),'') city,
   coalesce(nullif(trim(v.state),''),nullif(trim(g.state),''),'') state,
   lower(concat_ws(' ',g.name,g.description,v.name,v.tagline,v.city,v.state,g.city,g.state,community_region(coalesce(v.state,g.state)))) searchable
  FROM groups g LEFT JOIN venues v ON v.id=g.venue_id
  WHERE g.visibility='public' AND (g.venue_id IS NULL OR (v.is_active AND v.is_published AND coalesce(v.is_searchable,false)))
   AND NOT EXISTS(SELECT 1 FROM private_venue_sandboxes s WHERE s.group_id=g.id OR s.venue_id=g.venue_id)
 ), ranked AS (
  SELECT *,CASE WHEN community_region(p_state)<>'' AND community_region(state)=community_region(p_state)
    THEN CASE WHEN trim(coalesce(p_city,''))<>'' AND lower(city)=lower(trim(p_city)) THEN 0 ELSE 1 END ELSE 2 END area_rank
  FROM candidates c WHERE NOT EXISTS(SELECT 1 FROM unnest(regexp_split_to_array(lower(trim(left(coalesce(p_search,''),100))),'\s+')) term WHERE strpos(c.searchable,term)=0)
 ), page AS (
  SELECT *,row_number() OVER(ORDER BY area_rank, (lower(name)=lower(trim(p_search))) DESC NULLS LAST, is_venue_verified DESC NULLS LAST, member_count DESC, lower(name),id) position
  FROM ranked ORDER BY area_rank,(lower(name)=lower(trim(p_search))) DESC NULLS LAST,is_venue_verified DESC NULLS LAST,member_count DESC,lower(name),id
  LIMIT 25 OFFSET greatest(0,least(coalesce(p_offset,0),10000))
 ), visible AS (SELECT * FROM page ORDER BY position LIMIT 24)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(get_public_community(id,NULL)||jsonb_build_object('type',type,'city',city,'state',state) ORDER BY position) FROM visible),'[]'::jsonb),'has_more',(SELECT count(*)>24 FROM page))
$$;
REVOKE ALL ON FUNCTION public.discover_communities(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discover_communities(text,text,text,integer) TO anon,authenticated,service_role;
COMMIT;
