BEGIN;
-- Dismissal is reversible; existing notifications remain visible.
ALTER TABLE public.user_notifications ADD COLUMN dismissed_at timestamptz;
CREATE INDEX user_notifications_visible_unread ON public.user_notifications(user_id,created_at DESC) WHERE dismissed_at IS NULL AND NOT read;
-- Merge only the supplied setting keys under the existing groups RLS policies.
CREATE FUNCTION public.patch_group_settings(p_group_id uuid,p_patch jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT pulse_has_required_mfa() THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
 IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' THEN RAISE EXCEPTION 'Provide settings to update'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_patch) e WHERE jsonb_typeof(e.value)<>'boolean' OR e.key NOT IN (
  'allow_member_posts','require_post_approval','allow_member_events','allow_member_lfg',
  'moderators_can_approve_posts','moderators_can_approve_members','moderators_can_remove_members',
  'moderators_can_create_events','moderators_can_manage_files','chat_enabled','allow_member_chat','files_enabled','allow_member_uploads')) THEN
  RAISE EXCEPTION 'Unknown setting or invalid value';
 END IF;
 UPDATE groups SET settings=coalesce(settings,'{}'::jsonb)||p_patch WHERE id=p_group_id RETURNING settings INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'Community settings were not saved. Check your access and try again.' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.patch_group_settings(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.patch_group_settings(uuid,jsonb) TO authenticated;
COMMIT;
