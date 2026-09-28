-- Manager-requested live program calendar, November 2–29, 2026.
-- Uses ordinary RSVP-able events and the same recurrence metadata as the wizard.
-- No fabricated attendees, payments, court inventory, or reservation rows.
BEGIN;
DO $$
DECLARE
  v constant uuid := 'd99d7de3-2431-4ee2-a826-04cc293da1cd';
  g constant uuid := 'd5b47d17-d217-441a-a62a-bcdd87307d62';
  actor uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id=v) THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('rally-haus-november-2026',0));
  SELECT created_by INTO actor FROM public.groups
    WHERE id=g AND venue_id=v AND type='venue_official' FOR UPDATE;
  IF actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.group_members WHERE group_id=g AND user_id=actor AND role='owner' AND status='active'
  ) THEN RAISE EXCEPTION 'Rally Haus schedule requires its existing venue community owner'; END IF;
  IF (SELECT timezone FROM public.venues WHERE id=v) IS DISTINCT FROM 'America/New_York' THEN
    RAISE EXCEPTION 'Confirm the Rally Haus time zone before importing its schedule';
  END IF;

  CREATE TEMP TABLE rally_haus_november_schedule ON COMMIT DROP AS
  WITH programs(code,weekday,title,format,starts,ends,capacity,skill_min,skill_max,rotation,details) AS (VALUES
    ('mon-am',1,'Monday Morning Open Play','open_play','07:00','09:00',24,2.5,4.0,'paddle_stack',
      'Start the week with friendly doubles. Rotate partners through the paddle stack; games to 11, win by 2. Best for players comfortable serving and keeping score.'),
    ('mon-clinic',1,'Your First Rally: Beginner Clinic','clinic','09:30','11:00',8,NULL,2.5,'coach_led',
      'Learn court positioning, the two-bounce rule, scoring, serving, and returning. A small-group introduction followed by guided games. No playing experience required.'),
    ('mon-practice',1,'Serve & Return Practice','practice','12:00','13:30',12,2.5,3.5,'timed_rotation',
      'Build reliable starts to every point. Work in rotating pairs on deep serves, balanced returns, recovery, and the first four shots, then apply the patterns in practice games.'),
    ('mon-social',1,'Monday Social Doubles','social','18:00','20:00',24,2.5,4.0,'timed_rotation',
      'Meet playing partners in relaxed doubles with timed rotations. Sign up solo or with a friend; partners change throughout the evening and results are for friendly play.'),
    ('tue-am',2,'Tuesday Morning Open Play','open_play','07:00','09:00',24,2.5,4.0,'paddle_stack',
      'A morning doubles rotation for players who know the rules. Use the paddle stack, welcome new partners, and keep games moving so everyone gets court time.'),
    ('tue-clinic',2,'Dinks, Drops & Resets Clinic','clinic','09:30','11:00',8,2.5,3.5,'coach_led',
      'Develop touch at the kitchen line, a repeatable third-shot drop, and a calm reset under pressure. Small-group drills finish with controlled points that reinforce the session.'),
    ('tue-lunch',2,'Lunchtime Open Play','open_play','12:00','14:00',24,2.5,4.0,'paddle_stack',
      'Fit in doubles during the middle of the day. Games to 11 with a paddle-stack rotation and balanced partner pairings. Join on your own; a partner is not required.'),
    ('tue-rr',2,'Tuesday Round Robin: 3.0–3.5','round_robin','18:00','20:00',16,3.0,3.5,'organized_games',
      'Five organized rounds for 16 players across four playing groups, with changing partners. Arrive ready for the first round; use the session to build match experience and meet similarly skilled players.'),
    ('wed-am',3,'Wednesday Morning Open Play','open_play','07:00','09:00',24,2.5,4.0,'paddle_stack',
      'Keep your week moving with social doubles and a paddle-stack rotation. Players should know the scoring and basic rules; switch partners regularly and welcome everyone into the rotation.'),
    ('wed-practice',3,'Third-Shot Practice Lab','practice','09:30','11:00',12,3.0,4.0,'timed_rotation',
      'Practice choosing between a third-shot drive and drop, following the ball toward the kitchen, and resetting the next shot. Rotate drill partners before short scenario games.'),
    ('wed-adults',3,'Active Adults 50+ Open Play','open_play','12:00','14:00',24,2.5,4.0,'paddle_stack',
      'A daytime doubles session for the 50+ community. Expect friendly games, a steady rotation, and time to connect between matches. Players should be comfortable serving and keeping score.'),
    ('wed-social',3,'Women’s Wednesday Social','social','18:00','20:00',24,2.5,4.0,'timed_rotation',
      'An evening for women to connect through friendly doubles. Join solo, rotate partners, and meet future practice partners. Timed rounds keep the evening welcoming and organized.'),
    ('thu-am',4,'Thursday Morning Open Play','open_play','07:00','09:00',24,2.5,4.0,'paddle_stack',
      'Start the day with doubles and a friendly paddle-stack rotation. Games to 11; mix partners and help keep the playing groups balanced.'),
    ('thu-clinic',4,'Beginner Clinic: Rules to Rallies','clinic','09:30','11:00',8,NULL,2.5,'coach_led',
      'A complete beginner session covering safe movement, the kitchen, scoring, serve technique, and the return. Finish with guided doubles so the rules make sense in a real rally.'),
    ('thu-practice',4,'Doubles Positioning & Communication','practice','12:00','13:30',12,2.5,3.5,'timed_rotation',
      'Practice moving with a partner, calling the middle ball, covering lobs, and recovering together. Use repeatable game scenarios with rotating pairs.'),
    ('thu-rr',4,'Thursday Round Robin: 3.5–4.0','round_robin','18:00','20:00',16,3.5,4.0,'organized_games',
      'Five organized rounds for experienced recreational players. Rotate partners across four playing groups and bring consistent serves, returns, and kitchen play. No fixed partner required.'),
    ('fri-am',5,'Friday Morning Open Play','open_play','07:00','09:00',24,2.5,4.0,'paddle_stack',
      'Wrap up the workweek with a morning doubles rotation. Use the paddle stack, play games to 11, and switch partners so every player gets a varied session.'),
    ('fri-clinic',5,'Transition Zone Clinic','clinic','09:30','11:00',8,3.0,4.0,'coach_led',
      'Learn to move from the baseline to the kitchen with control. Practice split steps, low resets, and patient shot selection before applying them in coached points.'),
    ('fri-lunch',5,'Friday Lunchtime Open Play','open_play','12:00','14:00',24,2.5,4.0,'paddle_stack',
      'A mid-day doubles session before the weekend. Join without a partner, rotate through the paddle stack, and make room for players of similar experience.'),
    ('fri-social',5,'Friday Night Rally Social','social','18:00','20:00',28,2.5,4.0,'timed_rotation',
      'An easygoing end to the week with rotating doubles and time to meet the community. Come on your own or with friends; timed rounds keep everyone involved.'),
    ('sat-am',6,'Weekend Open Play','open_play','08:00','10:00',24,2.5,4.0,'paddle_stack',
      'Start Saturday with friendly doubles. Games to 11, paddle-stack rotations, and changing partners. Suitable for players comfortable with the rules and scoring.'),
    ('sat-clinic',6,'Saturday Start: Learn Pickleball','clinic','10:30','12:00',8,NULL,2.5,'coach_led',
      'A weekend introduction for brand-new players. Learn scoring, serve and return basics, safe court movement, and the kitchen rule, then put it together in guided games.'),
    ('sat-rr',6,'Saturday Mixed Doubles Round Robin','round_robin','13:00','15:30',16,3.0,4.0,'organized_games',
      'Five rounds of mixed doubles with partner rotations and breaks between rounds. Register individually; the organizer forms playing groups at check-in. A relaxed competition focused on varied matches.'),
    ('sat-family',6,'Family Rally Afternoon','social','16:00','18:00',24,NULL,NULL,'timed_rotation',
      'A relaxed session for families to play together with short games and frequent rotations. A participating adult must stay with junior players. Reserve one spot for each person playing.'),
    ('sun-orientation',7,'New Player Orientation','other','08:00','09:00',12,NULL,NULL,NULL,
      'Get to know the venue community, learn how PULSE sign-ups and waitlists work, and review court etiquette. A friendly starting point before joining a beginner clinic or open play.'),
    ('sun-practice',7,'Sunday Drill Club','practice','09:30','11:00',12,2.5,3.5,'timed_rotation',
      'Practice with a purpose: warm-up dinks, serve and return targets, controlled volleys, and short conditioned games. Rotate partners and finish with one focus for your next match.'),
    ('sun-rr',7,'Sunday Development Round Robin','round_robin','12:00','14:00',16,2.5,3.5,'organized_games',
      'Build confidence through five organized rounds with changing partners. For players who know the rules and want more match experience in a supportive setting.'),
    ('sun-mixer',7,'Sunday Community Mixer','social','15:00','17:00',24,2.5,4.0,'timed_rotation',
      'Close the weekend with social doubles, new partners, and a chance to arrange your next game. Timed rotations and friendly points keep the afternoon relaxed.')
  ), dates AS (
    SELECT date '2026-11-02'+n AS day FROM generate_series(0,27) n
    WHERE date '2026-11-02'+n <> date '2026-11-26'
  )
  SELECT md5('rally-haus-november-2026:'||code||':'||day::text)::uuid AS id,
    md5('rally-haus-november-2026:series:'||code)::uuid AS series_id,
    'WEEKLY:'||count(*) OVER (PARTITION BY code) AS recurring_rule,
    title, format AS event_format,
    (day+starts::time) AT TIME ZONE 'America/New_York' AS start_time,
    (day+ends::time) AT TIME ZONE 'America/New_York' AS end_time,
    capacity, skill_min, skill_max, rotation,
    details||E'\n\nPlease arrive 10 minutes early and RSVP for each player. If the session is full, join the waitlist; cancel your RSVP if your plans change.' AS description
  FROM programs JOIN dates ON extract(isodow FROM day)=weekday;

  IF (SELECT count(*) FROM rally_haus_november_schedule) <> 108 THEN
    RAISE EXCEPTION 'Incomplete Rally Haus schedule';
  END IF;
  -- Never silently double-book over existing venue programming. A retry skips
  -- existing IDs, preserving subsequent edits and per-event RSVP lists.
  IF EXISTS (
    SELECT 1 FROM rally_haus_november_schedule s JOIN public.group_events e
      ON e.venue_id=v AND e.start_time<s.end_time AND coalesce(e.end_time,e.start_time+interval '1 hour')>s.start_time
    WHERE NOT EXISTS (SELECT 1 FROM public.group_events saved WHERE saved.id=s.id)
      AND NOT EXISTS (SELECT 1 FROM rally_haus_november_schedule imported WHERE imported.id=e.id)
  ) THEN RAISE EXCEPTION 'Existing Rally Haus event conflicts with the November import'; END IF;

  INSERT INTO public.group_events(id,group_id,venue_id,created_by,title,description,location_type,
    start_time,end_time,event_format,capacity,skill_level_min,skill_level_max,rotation_style,
    waitlist_enabled,waitlist_limit,is_recurring,recurring_rule,series_id,rr_courts,rr_games_per_player)
  SELECT id,g,v,actor,title,description,'venue',start_time,end_time,event_format,capacity,skill_min,skill_max,rotation,
    true,greatest(4,capacity/2),true,recurring_rule,series_id,
    CASE WHEN event_format='round_robin' THEN 4 END,CASE WHEN event_format='round_robin' THEN 5 END
  FROM rally_haus_november_schedule ORDER BY start_time
  ON CONFLICT(id) DO NOTHING;
  IF (SELECT count(*) FROM public.group_events e JOIN rally_haus_november_schedule s USING(id)
    WHERE e.group_id=g AND e.venue_id=v) <> 108 THEN RAISE EXCEPTION 'Rally Haus schedule import did not complete'; END IF;

  INSERT INTO public.group_files(id,group_id,uploader_id,file_url,file_name,file_type,file_size)
  VALUES('948f5100-bb84-49df-a126-7de710000004',g,actor,
    'https://pulsepb.com/venues/rally-haus/november-2026.ics','Rally Haus Sports — November 2026 calendar.ics','text/calendar',74033)
  ON CONFLICT(id) DO NOTHING;

  INSERT INTO public.group_posts(id,group_id,user_id,type,title,content,pinned)
  VALUES('948f5200-bb84-49df-a126-7de710000006',g,actor,'announcement','Your November play calendar is here',
    E'November 2–29: 108 sessions across open play, beginner and skills clinics, focused practice, round robins, family play, and community socials.\n\nFour sessions on each program day, with space between sessions. No organized programs on Thanksgiving, November 26. All times are Eastern.\n\nOpen Play and Clinics live in the Play tab; round robins and socials also appear under Events. Each session has its own RSVP list, capacity, and waitlist. You can download the November calendar from Venue files & policies.\n\nStart here: https://pulsepb.com/venues/rally-haus-sports-d99d7de3?tab=play&day=2026-11-02',true)
  ON CONFLICT(id) DO NOTHING;
  UPDATE public.venues SET welcome_message=
    'Explore 108 scheduled sessions from November 2–29: open play, clinics, practice, round robins, family play, and socials. Browse Play and Events to choose your session and RSVP. All times are Eastern; no organized programs on Thanksgiving, November 26.'
  WHERE id=v AND welcome_message=
    'Welcome to the Rally Haus community. Explore the official announcement in our community photos and files, join the conversation, and stay connected as the new venue takes shape.';
END $$;
COMMIT;
