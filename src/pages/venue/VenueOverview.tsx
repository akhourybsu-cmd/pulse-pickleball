import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMode } from '@/contexts/ModeContext';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { useVenueStaff } from '@/hooks/useVenueStaff';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { MapPin, Calendar, Users, Plus, Settings, CalendarPlus, UserPlus, CalendarDays, BarChart3, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { isToday, isFuture } from 'date-fns';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';

export default function VenueOverview() {
  const { venueAccess, currentVenueId } = useMode();
  const currentVenue = venueAccess.find(v => v.venue_id === currentVenueId);
  const { courts, loading: courtsLoading } = useVenueCourts(currentVenueId);
  const { staff, loading: staffLoading } = useVenueStaff(currentVenueId);
  const { bookings, loading: bookingsLoading } = useVenueBookings(currentVenueId);
  const { events, loading: eventsLoading } = useVenueEvents(currentVenueId);
  const navigate = useNavigate();

  const activeCourts = courts.filter(c => c.is_active).length;
  const todayBookings = bookings.filter(b => isToday(new Date(b.start_time)) && b.status !== 'cancelled').length;
  const upcomingEvents = events.filter(e => isFuture(new Date(e.start_time)) && e.is_published).length;
  const loading = courtsLoading || staffLoading || bookingsLoading || eventsLoading;

  // Calculate setup progress
  const setupSteps = [
    { done: activeCourts > 0, label: 'Add your courts', action: '/venue/courts' },
    { done: events.length > 0, label: 'Create an event', action: '/venue/events' },
    { done: staff.length > 1, label: 'Invite team members', action: '/venue/staff' },
  ];
  const completedSteps = setupSteps.filter(s => s.done).length;
  const isFullySetup = completedSteps === setupSteps.length;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <img 
          src={pickleballPalaceLogo} 
          alt="Pickleball Palace" 
          className="h-14 w-auto hidden sm:block"
        />
        <div>
          <h1 className="text-2xl font-bold">{currentVenue?.venue_name || 'Venue Dashboard'}</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening at your venue.
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/courts')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courts</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{activeCourts}</div>
            )}
            <p className="text-xs text-muted-foreground">Active courts</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/bookings')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{todayBookings}</div>
            )}
            <p className="text-xs text-muted-foreground">Reservations today</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/staff')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{staff.length}</div>
            )}
            <p className="text-xs text-muted-foreground">Staff members</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate('/venue/events')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{upcomingEvents}</div>
            )}
            <p className="text-xs text-muted-foreground">Published events</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/courts')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Court
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/events')}>
              <CalendarPlus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/staff')}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/analytics')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => navigate('/venue/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Venue Settings
            </Button>
          </CardContent>
        </Card>

        {/* Setup Progress or Tips */}
        <Card>
          <CardHeader>
            <CardTitle>{isFullySetup ? 'Tips for Success' : 'Complete Your Setup'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isFullySetup ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <CalendarPlus className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Host regular events</p>
                    <p className="text-sm text-muted-foreground">Clinics and socials drive repeat visits</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Track your analytics</p>
                    <p className="text-sm text-muted-foreground">Identify peak times and popular offerings</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Engage your community</p>
                    <p className="text-sm text-muted-foreground">Players love venues that interact</p>
                  </div>
                </div>
              </>
            ) : (
              setupSteps.map((step, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => !step.done && navigate(step.action)}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    step.done 
                      ? 'bg-green-500/10 text-green-600' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <div>
                    <p className={`font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}