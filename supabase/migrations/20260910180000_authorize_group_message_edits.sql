-- Chat edits previously used UPDATE despite having no matching RLS policy.
-- Keep arbitrary row updates closed; expose only an author's content edit.
BEGIN;

CREATE OR REPLACE FUNCTION public.edit_group_message(p_message_id uuid, p_content text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message content is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.group_messages
  SET content = btrim(p_content), edited_at = now()
  WHERE id = p_message_id
    AND user_id = auth.uid()
    AND public.is_group_member(auth.uid(), group_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or edit not permitted' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.edit_group_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_group_message(uuid, text) TO authenticated;

COMMIT;
