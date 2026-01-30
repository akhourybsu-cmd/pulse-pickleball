-- Create friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Create index for friend lookups
CREATE INDEX idx_friendships_user_id ON public.friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON public.friendships(friend_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create conversation participants
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create indexes for conversation participants
CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants(conversation_id);

-- Create direct messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for direct messages
CREATE INDEX idx_direct_messages_conversation_id ON public.direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Friendships RLS Policies
CREATE POLICY "Users can view their friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendships" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their friendships" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Conversations RLS Policies
CREATE POLICY "Users can view conversations they participate in" ON public.conversations
  FOR SELECT USING (
    id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update conversations they participate in" ON public.conversations
  FOR UPDATE USING (
    id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

-- Conversation participants RLS Policies
CREATE POLICY "Users can view their conversation participations" ON public.conversation_participants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view other participants in their conversations" ON public.conversation_participants
  FOR SELECT USING (
    conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create conversation participations" ON public.conversation_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own participation" ON public.conversation_participants
  FOR UPDATE USING (auth.uid() = user_id);

-- Direct messages RLS Policies
CREATE POLICY "Users can view messages in their conversations" ON public.direct_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON public.direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Function to update conversation updated_at when new message arrives
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update conversation timestamp
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- Function to get or create a DM conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_conversation_id UUID;
  new_conversation_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Check for existing conversation between these two users
  SELECT cp1.conversation_id INTO existing_conversation_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = current_user_id 
    AND cp2.user_id = other_user_id
    AND (SELECT COUNT(*) FROM public.conversation_participants WHERE conversation_id = cp1.conversation_id) = 2;
  
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;
  
  -- Create new conversation
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO new_conversation_id;
  
  -- Add both participants
  INSERT INTO public.conversation_participants (conversation_id, user_id) 
  VALUES (new_conversation_id, current_user_id), (new_conversation_id, other_user_id);
  
  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;