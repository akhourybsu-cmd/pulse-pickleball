import { useState } from 'react';
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
import { usePublishReadiness } from '@/hooks/usePublishReadiness';
import { VenueWelcomeModal } from '@/components/venue-onboarding/VenueWelcomeModal';
import { PlanBadge } from '@/components/venue/PlanBadge';
import { VenueStatusBadge } from '@/components/venue/VenueStatusBadge';
import { PublishReadinessCard } from '@/components/venue/PublishReadinessCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  BarChart3,
  Trophy,
  Users2,
  ChevronRight,
  Building2,
  Eye,
  Zap
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
  
  // Map currentVenue to the format expected by usePublishReadiness
  const venueForReadiness = currentVenue ? {
    id: currentVenueId || '',
    name: currentVenue.venue_name || '',
    slug: null,
    address: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    timezone: null,
    phone: null,
    email: null,
    website: null,
    website_url: null,
    description: null,
    logo_url: currentVenue.logo_url || null,
    is_active: true,
    primary_color: currentVenue.primary_color || null,
    secondary_color: currentVenue.secondary_color || null,
    banner_url: null,
    cover_image_url: null,
    logo_shape: null,
    cover_focal_point: null,
    tagline: null,
    show_pulse_branding: true,
    social_facebook: null,
    social_instagram: null,
    instagram_url: null,
    facebook_url: null,
    x_url: null,
    tiktok_url: null,
    amenities: null,
    platform_fee_percent: null,
    venue_type: null,
    visibility: null,
    status: null,
    is_searchable: true,
    allow_follow: true,
    welcome_headline: null,
    welcome_message: null,
    cta_primary_label: null,
    cta_secondary_label: null,
  } : null;
  
  const publishReadiness = usePublishReadiness(venueForReadiness);
  const { 
    showWelcome, 
    setShowWelcome,
    venueName, 
    advanceStep, 
    skipOnboarding 
  } = useVenueOnboarding();
  const [futureToolsOpen, setFutureToolsOpen] = useState(false);

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
  const isPublished = currentVenue?.is_published ?? false;

  // Setup steps with completion status
  const setupSteps = [
    { label: 'Add your courts', done: courts.length > 0, action: '/venue/courts' },
    { label: 'Create an event', done: events.length > 0, action: '/venue/events' },
    { label: 'Invite team members', done: staff.length > 1, action: '/venue/staff' },
  ];

  const completedSteps = setupSteps.filter(s => s.done).length;
  const isFullySetup = completedSteps === setupSteps.length;

  // Check if this is a "new" venue (no events created yet)
  const isNewVenue = events.length === 0;

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
        <div className="flex items-start gap-5">
          <img 
            src={logoSrc} 
            alt={currentVenue?.venue_name || "Venue"} 
            className="h-20 w-auto hidden sm:block"
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <PlanBadge tier="free" />
              <VenueStatusBadge isPublished={isPublished} />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              {currentVenue?.venue_name || 'Venue Control Center'}
            </h1>
            <p className="text-gray-300 mt-1">
              Manage courts, events, and team
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">

      {/* New Venue: Create First Event CTA */}
      {isNewVenue && (
        <Card className="mb-8 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Ready to host your first event?</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Create tournaments at standard pricing or free Round Robins to engage your community.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={() => navigate(`/tournaments/new?venueId=${currentVenueId}`)}
                    className="gap-2"
                  >
                    <Trophy className="h-4 w-4" />
                    Create Your First Tournament
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/venue/events')}
                    className="gap-2"
                  >
                    <Users2 className="h-4 w-4" />
                    Create a Round Robin (Free)
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publish Readiness Card - Show when not fully ready */}
      {!publishReadiness.isReady && (
        <div className="mb-8">
          <PublishReadinessCard 
            readiness={publishReadiness} 
            venueTheme={venueTheme}
          />
        </div>
      )}

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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        {/* What You Get on Free Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: venueTheme.primary }} />
              What You Get on the Free Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${venueTheme.primary}15` }}
              >
                <Building2 className="h-4 w-4" style={{ color: venueTheme.primary }} />
              </div>
              <div>
                <p className="font-medium">Venue profile & listing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${venueTheme.primary}15` }}
              >
                <Trophy className="h-4 w-4" style={{ color: venueTheme.primary }} />
              </div>
              <div>
                <p className="font-medium">Tournaments at standard pricing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${venueTheme.primary}15` }}
              >
                <Users2 className="h-4 w-4" style={{ color: venueTheme.primary }} />
              </div>
              <div>
                <p className="font-medium">Unlimited Round Robins</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div 
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${venueTheme.primary}15` }}
              >
                <Eye className="h-4 w-4" style={{ color: venueTheme.primary }} />
              </div>
              <div>
                <p className="font-medium">Event visibility & discovery</p>
              </div>
            </div>

            {/* Future Upgrades - Collapsed */}
            <Collapsible open={futureToolsOpen} onOpenChange={setFutureToolsOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full pt-3 mt-3 border-t border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className={`h-4 w-4 transition-transform ${futureToolsOpen ? 'rotate-90' : ''}`} />
                Advanced tools coming later
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 pl-6 text-sm text-muted-foreground">
                We're working on advanced venue tools. You'll be notified when they're available.
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Setup Progress or Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isFullySetup ? (
                <>
                  <Zap className="h-5 w-5" style={{ color: venueTheme.primary }} />
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
