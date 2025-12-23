-- Create venue_bookings table for court reservations
CREATE TABLE public.venue_bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    court_id UUID NOT NULL REFERENCES public.venue_courts(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    notes TEXT,
    total_price NUMERIC(10,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue_events table
CREATE TABLE public.venue_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL DEFAULT 'tournament' CHECK (event_type IN ('tournament', 'clinic', 'social', 'league', 'other')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    max_participants INTEGER,
    current_participants INTEGER DEFAULT 0,
    price NUMERIC(10,2),
    skill_level TEXT,
    is_published BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue_coaches table
CREATE TABLE public.venue_coaches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    bio TEXT,
    specialties TEXT[],
    hourly_rate NUMERIC(10,2),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue_lessons table for coaching sessions
CREATE TABLE public.venue_lessons (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.venue_coaches(id) ON DELETE CASCADE,
    court_id UUID REFERENCES public.venue_courts(id),
    lesson_type TEXT NOT NULL DEFAULT 'private' CHECK (lesson_type IN ('private', 'group', 'clinic')),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    max_students INTEGER DEFAULT 1,
    current_students INTEGER DEFAULT 0,
    price NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.venue_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_lessons ENABLE ROW LEVEL SECURITY;

-- RLS policies for venue_bookings
CREATE POLICY "Venue staff can view bookings" ON public.venue_bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_bookings.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can create bookings" ON public.venue_bookings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_bookings.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can update bookings" ON public.venue_bookings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_bookings.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can delete bookings" ON public.venue_bookings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_bookings.venue_id
            AND vs.user_id = auth.uid()
            AND vs.role IN ('owner', 'manager')
        )
    );

-- RLS policies for venue_events
CREATE POLICY "Anyone can view published events" ON public.venue_events
    FOR SELECT USING (is_published = true);

CREATE POLICY "Venue staff can view all events" ON public.venue_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_events.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can create events" ON public.venue_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_events.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can update events" ON public.venue_events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_events.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete events" ON public.venue_events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_events.venue_id
            AND vs.user_id = auth.uid()
            AND vs.role IN ('owner', 'manager')
        )
    );

-- RLS policies for venue_coaches
CREATE POLICY "Anyone can view active coaches" ON public.venue_coaches
    FOR SELECT USING (is_active = true);

CREATE POLICY "Venue staff can view all coaches" ON public.venue_coaches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_coaches.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can manage coaches" ON public.venue_coaches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_coaches.venue_id
            AND vs.user_id = auth.uid()
            AND vs.role IN ('owner', 'manager')
        )
    );

-- RLS policies for venue_lessons
CREATE POLICY "Venue staff can view lessons" ON public.venue_lessons
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_lessons.venue_id
            AND vs.user_id = auth.uid()
        )
    );

CREATE POLICY "Venue staff can manage lessons" ON public.venue_lessons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.venue_staff vs
            WHERE vs.venue_id = venue_lessons.venue_id
            AND vs.user_id = auth.uid()
        )
    );

-- Create indexes for performance
CREATE INDEX idx_venue_bookings_venue_id ON public.venue_bookings(venue_id);
CREATE INDEX idx_venue_bookings_court_id ON public.venue_bookings(court_id);
CREATE INDEX idx_venue_bookings_start_time ON public.venue_bookings(start_time);
CREATE INDEX idx_venue_events_venue_id ON public.venue_events(venue_id);
CREATE INDEX idx_venue_events_start_time ON public.venue_events(start_time);
CREATE INDEX idx_venue_coaches_venue_id ON public.venue_coaches(venue_id);
CREATE INDEX idx_venue_lessons_venue_id ON public.venue_lessons(venue_id);
CREATE INDEX idx_venue_lessons_coach_id ON public.venue_lessons(coach_id);