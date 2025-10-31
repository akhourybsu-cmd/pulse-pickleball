-- Create court_channels table
CREATE TABLE public.court_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(court_id)
);

-- Create channel_messages table
CREATE TABLE public.channel_messages (
  id BIGSERIAL PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.court_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  thread_id BIGINT REFERENCES public.channel_messages(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.court_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for court_channels
CREATE POLICY "Anyone can view court channels"
  ON public.court_channels
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create court channels"
  ON public.court_channels
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS policies for channel_messages
CREATE POLICY "Anyone can view channel messages"
  ON public.channel_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create messages"
  ON public.channel_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.channel_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.channel_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;

-- Create index for better performance
CREATE INDEX idx_channel_messages_channel_id ON public.channel_messages(channel_id);
CREATE INDEX idx_channel_messages_created_at ON public.channel_messages(created_at);