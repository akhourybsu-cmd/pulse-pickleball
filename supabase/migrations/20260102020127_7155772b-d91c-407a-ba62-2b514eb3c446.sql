-- Update default settings for groups table with comprehensive permissions
ALTER TABLE public.groups 
ALTER COLUMN settings 
SET DEFAULT '{
  "allow_member_posts": true,
  "require_post_approval": false,
  "allow_member_events": true,
  "allow_member_lfg": true,
  "moderators_can_approve_posts": true,
  "moderators_can_approve_members": true,
  "moderators_can_remove_members": false,
  "moderators_can_create_events": true,
  "moderators_can_manage_files": true,
  "chat_enabled": true,
  "allow_member_chat": true,
  "files_enabled": true,
  "allow_member_uploads": true
}'::jsonb;

-- Backfill existing groups with new settings (merge with existing, don't overwrite)
UPDATE public.groups
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'allow_member_posts', COALESCE((settings->>'allow_member_posts')::boolean, true),
  'require_post_approval', COALESCE((settings->>'require_post_approval')::boolean, false),
  'allow_member_events', COALESCE((settings->>'allow_member_events')::boolean, true),
  'allow_member_lfg', COALESCE((settings->>'allow_member_lfg')::boolean, true),
  'moderators_can_approve_posts', COALESCE((settings->>'moderators_can_approve_posts')::boolean, true),
  'moderators_can_approve_members', COALESCE((settings->>'moderators_can_approve_members')::boolean, true),
  'moderators_can_remove_members', COALESCE((settings->>'moderators_can_remove_members')::boolean, false),
  'moderators_can_create_events', COALESCE((settings->>'moderators_can_create_events')::boolean, true),
  'moderators_can_manage_files', COALESCE((settings->>'moderators_can_manage_files')::boolean, true),
  'chat_enabled', COALESCE((settings->>'chat_enabled')::boolean, true),
  'allow_member_chat', COALESCE((settings->>'allow_member_chat')::boolean, true),
  'files_enabled', COALESCE((settings->>'files_enabled')::boolean, true),
  'allow_member_uploads', COALESCE((settings->>'allow_member_uploads')::boolean, true)
)
WHERE settings IS NULL 
   OR NOT (settings ? 'moderators_can_approve_posts');