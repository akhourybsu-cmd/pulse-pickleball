-- Import the venue's published assets into its existing community tools.
-- Sources: https://rallyhaussports.com/ and the operator's public announcement
-- at https://www.linkedin.com/in/debra-a-cohen-ed-d-5a16936 .
-- No invented schedules, attendance, court inventory, prices or reservations.
BEGIN;
DO $$
DECLARE
  v constant uuid := 'd99d7de3-2431-4ee2-a826-04cc293da1cd';
  g constant uuid := 'd5b47d17-d217-441a-a62a-bcdd87307d62';
  actor uuid;
  asset_base constant text := 'https://pulsepb.com/venues/rally-haus/';
BEGIN
  -- This is a targeted content import, not a seed for unrelated environments.
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rally-haus-official-content',0));
  SELECT created_by INTO actor FROM public.groups
    WHERE id=g AND venue_id=v AND type='venue_official' FOR UPDATE;
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id=g AND user_id=actor AND role='owner' AND status='active'
  ) THEN RAISE EXCEPTION 'Rally Haus import requires its existing venue community owner'; END IF;

  -- Fill empty fields only; preserve manager-authored branding and settings.
  UPDATE public.venues SET
    description=coalesce(nullif(btrim(description),''),
      'Rally Haus Sports is coming to Attleboro, Massachusetts. Plans include 10 indoor pickleball courts, 4 golf simulator suites, leagues, tournaments, lessons, and social events. Follow the official website and TeamReach for opening and programming updates.'),
    tagline=coalesce(nullif(btrim(tagline),''),'Where Competition Meets Community.'),
    welcome_message=coalesce(nullif(btrim(welcome_message),''),
      'Welcome to the Rally Haus community. Explore the official announcement in our community photos and files, join the conversation, and stay connected as the new venue takes shape.'),
    phone=coalesce(nullif(btrim(phone),''),'401-999-9065')
  WHERE id=v;

  INSERT INTO public.group_files(id,group_id,uploader_id,file_url,file_name,file_type,file_size) VALUES
    ('948f5100-bb84-49df-a126-7de710000001',g,actor,asset_base||'official-brand.png','Rally Haus Sports — official logo.png','image/png',135480),
    ('948f5100-bb84-49df-a126-7de710000002',g,actor,asset_base||'facility-preview.png','Rally Haus Sports — official announcement image.png','image/png',75829),
    ('948f5100-bb84-49df-a126-7de710000003',g,actor,asset_base||'official-announcement.mp4','Rally Haus Sports — official announcement.mp4','video/mp4',5107903)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO public.group_posts(id,group_id,user_id,type,title,content,image_url,pinned,poll_options) VALUES
    ('948f5200-bb84-49df-a126-7de710000001',g,actor,'announcement','Welcome to Rally Haus Sports',
      'A new home for pickleball, golf, and community is coming to Attleboro. Follow our updates here and at https://rallyhaussports.com/ as opening plans develop.',
      asset_base||'official-brand.png',true,NULL),
    ('948f5200-bb84-49df-a126-7de710000002',g,actor,'highlight','Watch the Rally Haus announcement',
      'See the original announcement shared on the Rally Haus website. The full video is available in our community Files: https://pulsepb.com/venues/rally-haus/official-announcement.mp4',
      asset_base||'facility-preview.png',false,NULL),
    ('948f5200-bb84-49df-a126-7de710000003',g,actor,'announcement','What is coming to Rally Haus',
      'The announced plans include 10 indoor pickleball courts and 4 golf simulator suites, plus leagues, tournaments, lessons, and social events for different skill levels. Opening dates and scheduled programs will be shared when confirmed.',
      NULL,false,NULL),
    ('948f5200-bb84-49df-a126-7de710000004',g,actor,'poll','What would you like to play first?',
      'Help shape our community programming. Vote for the activity you are most interested in and share your ideas in the comments.',
      NULL,false,'[{"idx":0,"text":"Open play"},{"idx":1,"text":"Lessons and clinics"},{"idx":2,"text":"Leagues and tournaments"},{"idx":3,"text":"Social events"},{"idx":4,"text":"Golf simulators"}]'::jsonb),
    ('948f5200-bb84-49df-a126-7de710000005',g,actor,'feed','Stay connected with Rally Haus',
      'Find Rally Haus Sports on TeamReach using code RallyHaus1. For questions, call 401-999-9065 or visit https://rallyhaussports.com/.',
      NULL,false,NULL)
  ON CONFLICT(id) DO NOTHING;
  IF (SELECT count(*) FROM public.group_files WHERE group_id=g AND id IN (
    '948f5100-bb84-49df-a126-7de710000001','948f5100-bb84-49df-a126-7de710000002','948f5100-bb84-49df-a126-7de710000003'
  )) <> 3 OR (SELECT count(*) FROM public.group_posts WHERE group_id=g AND id IN (
    '948f5200-bb84-49df-a126-7de710000001','948f5200-bb84-49df-a126-7de710000002','948f5200-bb84-49df-a126-7de710000003',
    '948f5200-bb84-49df-a126-7de710000004','948f5200-bb84-49df-a126-7de710000005'
  )) <> 5 THEN RAISE EXCEPTION 'Rally Haus content import did not complete'; END IF;
END $$;
COMMIT;
