import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMode } from '@/contexts/ModeContext';
import { useVenueCourts } from '@/hooks/useVenueCourts';
import { useVenueStaff } from '@/hooks/useVenueStaff';
import { useVenueBookings } from '@/hooks/useVenueBookings';
import { useVenueEvents } from '@/hooks/useVenueEvents';
import { useVenueOnboarding } from '@/hooks/useVenueOnboarding';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { VenueWelcomeModal } from '@/components/venue-onboarding/VenueWelcomeModal';
import { 
  MapPin, 
  Calendar, 
  Users, 
  CalendarDays, 
  Plus,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  CalendarPlus,
  UserPlus,
  Settings,
  BarChart3
} from 'lucide-react';
import { isToday, isFuture } from 'date-fns';
import { getVenueLogoSrc, getVenueLogoFallback } from '@/lib/venueBranding';

export default function VenueOverview() {
  const navigate = useNavigate();
  const { currentVenueId, currentVenue } = useMode();
  const { courts, loading: courtsLoading } = useVenueCourts(currentVenueId);
  const { staff, loading: staffLoading } = useVenueStaff(currentVenueId);
  const { bookings, loading: bookingsLoading } = useVenueBookings(currentVenueId);
  const { events, loading: eventsLoading } = useVenueEvents(currentVenueId);
  const venueTheme = useVenueTheme();
  const { 
    showWelcome, 
    setShowWelcome, 
    venueName, 
    advanceStep, 
    skipOnboarding 
  } = useVenueOnboarding();

  const loading = courtsLoading || staffLoading || bookingsLoading || eventsLoading;

  const activeCourts = courts.filter(c => c.is_active).length;
  const todayBookings = bookings.filter(b => 
    isToday(new Date(b.start_time)) && b.status !== 'cancelled'
  ).length;
  const upcomingEvents = events.filter(e => 
    e.is_published && (isFuture(new Date(e.start_time)) || isToday(new Date(e.start_time)))
  ).length;

  // Use centralized branding helper for reliable logo display
  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);

  // Setup steps with completion status
  const setupSteps = [
    { label: 'Add your courts', done: courts.length > 0, action: '/venue/courts' },
    { label: 'Create an event', done: events.length > 0, action: '/venue/events' },
    { label: 'Invite team members', done: staff.length > 1, action: '/venue/staff' },
  ];

  const completedSteps = setupSteps.filter(s => s.done).length;
  const isFullySetup = completedSteps === setupSteps.length;

  return (
    <>
      <VenueWelcomeModal
        open={showWelcome}
        onOpenChange={setShowWelcome}
        venueName={venueName}
        onGetStarted={() => {
          setShowWelcome(false);
          advanceStep();
        }}
        onSkip={() => {
          skipOnboarding();
        }}
      />
      <div>
      {/* Premium Gradient Hero Section */}
      <div 
        className="-mt-0 px-6 pt-8 pb-10 mb-8"
        style={{
          background: `linear-gradient(to bottom, ${venueTheme.secondary}, ${venueTheme.secondary}DD, transparent)`
        }}
      >
        <div className="flex items-center gap-5">
          <img 
            src={logoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-20 w-auto hidden sm:block"
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Venue Control Center
            </h1>
            <p className="text-gray-300 mt-1">
              Manage courts, events, and team for {currentVenue?.venue_name || 'your venue'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {loading ? (
          [1, 2, 3, 4].map(i => (
            <Card key={i} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-8 rounded-lg mb-3" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all group hover:border-l-4"
              style={{ '--hover-border-color': venueTheme.primary } as React.CSSProperties}
              onClick={() => navigate('/venue/courts')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Courts</CardTitle>
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${venueTheme.primary}15` }}
                >
                  <MapPin className="h-5 w-5" style={{ color: venueTheme.primary }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: venueTheme.primary }}>{activeCourts}</div>
                <p className="text-sm text-muted-foreground">Active courts</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all group hover:border-l-4"
              onClick={() => navigate('/venue/bookings')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Bookings</CardTitle>
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${venueTheme.primary}15` }}
                >
                  <Calendar className="h-5 w-5" style={{ color: venueTheme.primary }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: venueTheme.primary }}>{todayBookings}</div>
                <p className="text-sm text-muted-foreground">Reservations today</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all group hover:border-l-4"
              onClick={() => navigate('/venue/staff')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Team</CardTitle>
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${venueTheme.primary}15` }}
                >
                  <Users className="h-5 w-5" style={{ color: venueTheme.primary }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: venueTheme.primary }}>{staff.length}</div>
                <p className="text-sm text-muted-foreground">Staff members</p>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover:shadow-lg transition-all group hover:border-l-4"
              onClick={() => navigate('/venue/events')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: `${venueTheme.primary}15` }}
                >
                  <CalendarDays className="h-5 w-5" style={{ color: venueTheme.primary }} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" style={{ color: venueTheme.primary }}>{upcomingEvents}</div>
                <p className="text-sm text-muted-foreground">Published events</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions - Premium Dark Card */}
        <Card 
          className="border-0"
          style={{ backgroundColor: venueTheme.secondary }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${venueTheme.primary}25` }}
              >
                <Plus className="h-4 w-4" style={{ color: venueTheme.primary }} />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button 
              variant="outline" 
              className="justify-start border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/venue/courts')}
            >
              <Plus className="h-4 w-4 mr-2" style={{ color: venueTheme.primary }} />
              Add Court
            </Button>
            <Button 
              variant="outline" 
              className="justify-start border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/venue/events')}
            >
              <CalendarPlus className="h-4 w-4 mr-2" style={{ color: venueTheme.primary }} />
              Create Event
            </Button>
            <Button 
              variant="outline" 
              className="justify-start border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/venue/staff')}
            >
              <UserPlus className="h-4 w-4 mr-2" style={{ color: venueTheme.primary }} />
              Invite Team Member
            </Button>
            <Button 
              variant="outline" 
              className="justify-start border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/venue/analytics')}
            >
              <BarChart3 className="h-4 w-4 mr-2" style={{ color: venueTheme.primary }} />
              View Analytics
            </Button>
            <Button 
              variant="outline" 
              className="justify-start border-white/20 text-white hover:bg-white/10 hover:text-white"
              onClick={() => navigate('/venue/settings')}
            >
              <Settings className="h-4 w-4 mr-2" style={{ color: venueTheme.primary }} />
              Venue Settings
            </Button>
          </CardContent>
        </Card>

        {/* Setup Progress or Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isFullySetup ? (
                <>
                  <Sparkles className="h-5 w-5" style={{ color: venueTheme.primary }} />
                  Tips for Success
                </>
              ) : (
                'Complete Your Setup'
              )}
            </CardTitle>
            {!isFullySetup && (
              <CardDescription>
                {completedSteps} of {setupSteps.length} steps complete
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isFullySetup ? (
              <>
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${venueTheme.primary}15` }}
                  >
                    <CalendarPlus className="h-4 w-4" style={{ color: venueTheme.primary }} />
                  </div>
                  <div>
                    <p className="font-medium">Host regular events</p>
                    <p className="text-sm text-muted-foreground">Clinics and socials drive repeat visits</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${venueTheme.primary}15` }}
                  >
                    <BarChart3 className="h-4 w-4" style={{ color: venueTheme.primary }} />
                  </div>
                  <div>
                    <p className="font-medium">Track your analytics</p>
                    <p className="text-sm text-muted-foreground">Identify peak times and popular offerings</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div 
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${venueTheme.primary}15` }}
                  >
                    <Users className="h-4 w-4" style={{ color: venueTheme.primary }} />
                  </div>
                  <div>
                    <p className="font-medium">Engage your community</p>
                    <p className="text-sm text-muted-foreground">Players love venues that interact</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-full bg-muted rounded-full h-2 mb-4">
                  <div 
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${(completedSteps / setupSteps.length) * 100}%`,
                      backgroundColor: venueTheme.primary
                    }}
                  />
                </div>
                {setupSteps.map((step, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                    onClick={() => !step.done && navigate(step.action)}
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: venueTheme.primary }} />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={step.done ? 'text-muted-foreground line-through' : 'font-medium'}>
                      {step.label}
                    </span>
                    {!step.done && (
                      <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
    </>
  );
}
