ALTER TABLE public.round_robin_players ADD COLUMN IF NOT EXISTS guest_name text;
ALTER TABLE public.round_robin_players ALTER COLUMN player_id DROP NOT NULL;