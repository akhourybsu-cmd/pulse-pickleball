
-- 1. event_reminders_sent
DROP POLICY IF EXISTS "System can manage reminders" ON public.event_reminders_sent;
CREATE POLICY "Admins can view reminders sent"
  ON public.event_reminders_sent FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage reminders sent"
  ON public.event_reminders_sent FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. venue_bookings
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.venue_bookings;
DROP POLICY IF EXISTS "Users view own bookings" ON public.venue_bookings;
CREATE POLICY "Users can view their own bookings"
  ON public.venue_bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Venue staff can view all venue bookings"
  ON public.venue_bookings FOR SELECT TO authenticated
  USING (
    public.has_venue_role(auth.uid(), venue_id, 'owner'::venue_role)
    OR public.has_venue_role(auth.uid(), venue_id, 'manager'::venue_role)
    OR public.has_venue_role(auth.uid(), venue_id, 'staff'::venue_role)
  );

-- 3. venue_coaches
DROP POLICY IF EXISTS "Anyone can view active coaches" ON public.venue_coaches;
CREATE OR REPLACE VIEW public.venue_coaches_public
WITH (security_invoker = on) AS
SELECT id, venue_id, user_id, name, bio, specialties, hourly_rate,
       is_active, avatar_url, created_at, updated_at
FROM public.venue_coaches WHERE is_active = true;
GRANT SELECT ON public.venue_coaches_public TO anon, authenticated;

CREATE POLICY "Venue staff can view coach details"
  ON public.venue_coaches FOR SELECT TO authenticated
  USING (
    public.has_venue_role(auth.uid(), venue_id, 'owner'::venue_role)
    OR public.has_venue_role(auth.uid(), venue_id, 'manager'::venue_role)
    OR public.has_venue_role(auth.uid(), venue_id, 'staff'::venue_role)
    OR auth.uid() = user_id
  );

REVOKE SELECT ON public.venue_coaches FROM anon;
GRANT SELECT (id, venue_id, user_id, name, bio, specialties, hourly_rate, is_active, avatar_url, created_at, updated_at)
  ON public.venue_coaches TO anon, authenticated;

CREATE POLICY "Public can view active coaches (limited columns)"
  ON public.venue_coaches FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 4. venues — column-level revocation for sensitive fields from anon
REVOKE SELECT ON public.venues FROM anon;
GRANT SELECT (
  id, name, slug, address, city, state, zip_code, timezone, website,
  description, logo_url, owner_id, is_active, created_at, updated_at,
  primary_color, secondary_color, banner_url, tagline, show_pulse_branding,
  social_facebook, social_instagram, hours_of_operation, amenities,
  platform_fee_percent, onboarding_completed, onboarding_step,
  activation_state, is_published, venue_type, address_line1, address_line2,
  country, website_url, instagram_url, facebook_url, x_url, tiktok_url,
  logo_shape, cover_image_url, cover_focal_point, welcome_headline,
  welcome_message, cta_primary_label, cta_secondary_label, visibility,
  status, is_searchable, allow_follow, verification_requested_at,
  verification_approved_at, verification_approved_by, has_player_profile
) ON public.venues TO anon;

-- 5. tournament_customization
DROP POLICY IF EXISTS "Public can view published customizations" ON public.tournament_customization;
REVOKE SELECT ON public.tournament_customization FROM anon;
GRANT SELECT (
  id, event_id, is_published, hero_image_url, hero_overlay_color, tagline,
  about_markdown, about_image_url, map_embed, venue_photo_url, sponsors,
  policies_text, theme_accent, venue_details, created_at, updated_at,
  refund_policy, weather_policy, conduct_policy, liability_policy,
  extra_notes, organizer_message
) ON public.tournament_customization TO anon, authenticated;

CREATE POLICY "Public can view published customizations (no PII)"
  ON public.tournament_customization FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- 6. admin_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND admin_user_id = auth.uid()
  );

-- 7. conversation_participants
DROP POLICY IF EXISTS "Users can create conversation participations" ON public.conversation_participants;
CREATE POLICY "Users can add themselves to conversations"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 8. channel_messages — require auth
DROP POLICY IF EXISTS "Authenticated users can view channel messages" ON public.channel_messages;
CREATE POLICY "Authenticated users can view channel messages"
  ON public.channel_messages FOR SELECT TO authenticated
  USING (true);

-- 9. venue_event_registrations
DROP POLICY IF EXISTS "Anyone can view event registrations" ON public.venue_event_registrations;
CREATE POLICY "Users can view their own venue event registrations"
  ON public.venue_event_registrations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Venue staff can view venue event registrations"
  ON public.venue_event_registrations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_events ve
      WHERE ve.id = venue_event_registrations.event_id
        AND (
          public.has_venue_role(auth.uid(), ve.venue_id, 'owner'::venue_role)
          OR public.has_venue_role(auth.uid(), ve.venue_id, 'manager'::venue_role)
          OR public.has_venue_role(auth.uid(), ve.venue_id, 'staff'::venue_role)
        )
    )
  );

-- 10. match_approvals
DROP POLICY IF EXISTS "System can insert match approvals" ON public.match_approvals;
CREATE POLICY "Players can insert their match approvals"
  ON public.match_approvals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = player_id);

-- 11. player_badges
DROP POLICY IF EXISTS "System can insert player badges" ON public.player_badges;
DROP POLICY IF EXISTS "System can update player badges" ON public.player_badges;
CREATE POLICY "Admins can insert player badges"
  ON public.player_badges FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update player badges"
  ON public.player_badges FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 12. Storage: groups bucket
DROP POLICY IF EXISTS "Group admins can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Group admins can delete avatars" ON storage.objects;

CREATE POLICY "Group admins can upload avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'groups'
    AND public.is_group_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "Group admins can update avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'groups'
    AND public.is_group_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "Group admins can delete avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'groups'
    AND public.is_group_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
