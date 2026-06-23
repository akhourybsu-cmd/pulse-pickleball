
-- Fix infinite recursion on conversation_participants by using a SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

-- conversation_participants: drop recursive policy and recreate using helper
DROP POLICY IF EXISTS "Users can view other participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view other participants in their conversations"
ON public.conversation_participants
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- conversations: replace subquery-based policies with helper
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
CREATE POLICY "Users can view conversations they participate in"
ON public.conversations
FOR SELECT
USING (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Users can update conversations they participate in" ON public.conversations;
CREATE POLICY "Users can update conversations they participate in"
ON public.conversations
FOR UPDATE
USING (public.is_conversation_participant(id, auth.uid()));

-- direct_messages: SELECT uses helper too
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.direct_messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.direct_messages
FOR SELECT
USING (public.is_conversation_participant(conversation_id, auth.uid()));
