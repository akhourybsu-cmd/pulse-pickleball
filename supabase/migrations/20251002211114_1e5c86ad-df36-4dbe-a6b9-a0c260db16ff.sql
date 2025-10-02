-- Create role enum for access control
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table with security definer function to avoid RLS recursion
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create sessions table
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID REFERENCES public.courts(id) NOT NULL,
  name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME,
  num_courts INTEGER NOT NULL DEFAULT 3,
  match_type TEXT NOT NULL DEFAULT 'ladder',
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sessions"
  ON public.sessions FOR SELECT
  USING (status = 'active' OR auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create check_ins table for player presence
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (session_id, player_id)
);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view check-ins for active sessions"
  ON public.check_ins FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sessions 
    WHERE id = session_id AND status = 'active'
  ));

CREATE POLICY "Users can check themselves in"
  ON public.check_ins FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own check-in status"
  ON public.check_ins FOR UPDATE
  USING (auth.uid() = player_id);

-- Create queue_entries table
CREATE TABLE public.queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  priority INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  UNIQUE (session_id, player_id)
);

ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view queue entries"
  ON public.queue_entries FOR SELECT
  USING (true);

CREATE POLICY "Users can join queue"
  ON public.queue_entries FOR INSERT
  WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their queue status"
  ON public.queue_entries FOR UPDATE
  USING (auth.uid() = player_id);

CREATE POLICY "Admins can manage queue"
  ON public.queue_entries FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create match_tickets table
CREATE TABLE public.match_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  court_number INTEGER NOT NULL,
  team1_player1_id UUID REFERENCES public.profiles(id) NOT NULL,
  team1_player2_id UUID REFERENCES public.profiles(id) NOT NULL,
  team2_player1_id UUID REFERENCES public.profiles(id) NOT NULL,
  team2_player2_id UUID REFERENCES public.profiles(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'on-deck',
  team1_score INTEGER,
  team2_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  match_id UUID REFERENCES public.matches(id)
);

ALTER TABLE public.match_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view match tickets"
  ON public.match_tickets FOR SELECT
  USING (true);

CREATE POLICY "Players in match can update ticket"
  ON public.match_tickets FOR UPDATE
  USING (
    auth.uid() IN (team1_player1_id, team1_player2_id, team2_player1_id, team2_player2_id)
  );

CREATE POLICY "Admins can manage match tickets"
  ON public.match_tickets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create triggers for updated_at
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert admin role for akhourybsu@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'akhourybsu@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;