import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePublicVenue, VenueCourt, VenueEvent, VenueCoach } from '@/hooks/usePublicVenue';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenueShell, TabId } from '@/components/venue-public/PublicVenueShell';
import { PublicHomeTab } from '@/components/venue-public/PublicHomeTab';
import { PublicScheduleTab } from '@/components/venue-public/PublicScheduleTab';
import { PublicEventsTab } from '@/components/venue-public/PublicEventsTab';
import { PublicCoachingTab } from '@/components/venue-public/PublicCoachingTab';
import { PublicInfoTab } from '@/components/venue-public/PublicInfoTab';
import { BookingFlowDialog } from '@/components/venue-public/BookingFlowDialog';
import { EventRegistrationDialog } from '@/components/venue-public/EventRegistrationDialog';
import { CoachLessonBookingDialog } from '@/components/venue-public/CoachLessonBookingDialog';
import { TimeSlot } from '@/hooks/useVenueAvailability';

export default function PublicVenueLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { venue, courts, events, coaches, loading, error } = usePublicVenue(slug);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [registeredEventIds, setRegisteredEventIds] = useState<string[]>([]);
  
  // Booking dialog state
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<VenueCourt | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  
  // Event registration dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<VenueEvent | null>(null);
  
  // Coach booking dialog state
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<VenueCoach | null>(null);

  // Check auth status and fetch registrations
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      
      if (user && venue) {
        // Fetch user's registrations for this venue's events
        const { data: registrations } = await supabase
          .from('venue_event_registrations')
          .select('event_id')
          .eq('user_id', user.id)
          .eq('status', 'registered');
        
        if (registrations) {
          setRegisteredEventIds(registrations.map(r => r.event_id));
        }
      }
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });
    
    return () => subscription.unsubscribe();
  }, [venue]);

  // Handlers - removed handleBookCourt as we navigate to schedule tab instead

  const handleSelectSlot = (court: VenueCourt, date: Date, slot: TimeSlot) => {
    setSelectedCourt(court);
    setSelectedDate(date);
    setSelectedSlot(slot);
    setBookingOpen(true);
  };

  const handleRegisterEvent = (event: VenueEvent) => {
    setSelectedEvent(event);
    setEventDialogOpen(true);
  };

  const handleBookCoach = (coach: VenueCoach) => {
    setSelectedCoach(coach);
    setCoachDialogOpen(true);
  };

  const handleRegistrationSuccess = () => {
    if (selectedEvent) {
      setRegisteredEventIds(prev => [...prev, selectedEvent.id]);
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Venue Not Found</h1>
          <p className="text-muted-foreground mb-4">This venue doesn't exist or is no longer active.</p>
          <Button asChild>
            <Link to="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PublicVenueShell venue={venue} courts={courts} events={events} coaches={coaches}>
        {(activeTab, setActiveTab) => (
          <>
            {activeTab === 'home' && (
              <PublicHomeTab
                venue={venue}
                courts={courts}
                events={events}
                coaches={coaches}
                onNavigate={setActiveTab}
                onRegisterEvent={handleRegisterEvent}
              />
            )}
            {activeTab === 'schedule' && (
              <PublicScheduleTab
                venue={venue}
                courts={courts}
                onSelectSlot={handleSelectSlot}
              />
            )}
            {activeTab === 'events' && (
              <PublicEventsTab
                venue={venue}
                events={events}
                onRegister={handleRegisterEvent}
                registeredEventIds={registeredEventIds}
              />
            )}
            {activeTab === 'coaching' && (
              <PublicCoachingTab
                venue={venue}
                coaches={coaches}
                onBookCoach={handleBookCoach}
              />
            )}
            {activeTab === 'info' && (
              <PublicInfoTab venue={venue} />
            )}
          </>
        )}
      </PublicVenueShell>

      {/* Booking Dialog */}
      <BookingFlowDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        venue={venue}
        court={selectedCourt}
        date={selectedDate}
        slot={selectedSlot}
        isAuthenticated={isAuthenticated}
      />

      {/* Event Registration Dialog */}
      <EventRegistrationDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        venue={venue}
        event={selectedEvent}
        isAuthenticated={isAuthenticated}
        isRegistered={selectedEvent ? registeredEventIds.includes(selectedEvent.id) : false}
        onSuccess={handleRegistrationSuccess}
      />

      {/* Coach Booking Dialog */}
      <CoachLessonBookingDialog
        open={coachDialogOpen}
        onOpenChange={setCoachDialogOpen}
        venue={venue}
        coach={selectedCoach}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border flex items-center px-4">
        <Skeleton className="h-8 w-8 rounded-lg mr-3" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="h-[50vh] bg-muted animate-pulse" />
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
