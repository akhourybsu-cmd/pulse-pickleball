import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  ChevronRight,
  Award,
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { PublicVenue, VenueCourt, VenueEvent, VenueCoach } from '@/hooks/usePublicVenue';
import { TabId } from './PublicVenueShell';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';

interface PublicHomeTabProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  events: VenueEvent[];
  coaches: VenueCoach[];
  onNavigate: (tab: TabId) => void;
  onRegisterEvent: (event: VenueEvent) => void;
}

export function PublicHomeTab({ 
  venue, 
  courts, 
  events, 
  coaches, 
  onNavigate,
  onRegisterEvent
}: PublicHomeTabProps) {
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  return (
    <div className="space-y-0">
      {/* Hero Section */}
      <section 
        className="relative min-h-[50vh] flex items-center justify-center overflow-hidden"
        style={{
          background: venue.banner_url 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${venue.banner_url}) center/cover`
            : `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}30)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Logo as primary hero element */}
          <img 
            src={venue.logo_url || pickleballPalaceLogo} 
            alt={venue.name}
            className="mx-auto mb-4 object-contain"
            style={{
              maxHeight: '100px',
              maxWidth: '320px',
              width: 'auto',
              height: 'auto',
            }}
          />
          
          {/* Tagline - subdued supporting text */}
          {venue.tagline && (
            <p 
              className="text-base md:text-lg mb-6 opacity-75"
              style={{ color: venue.banner_url ? 'white' : secondaryColor }}
            >
              {venue.tagline}
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              size="lg" 
              className="text-base px-6"
              onClick={() => onNavigate('schedule')}
              style={{ 
                backgroundColor: primaryColor, 
                color: 'white',
              }}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book a Court
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-base px-6 bg-white/90 hover:bg-white"
              onClick={() => onNavigate('events')}
              style={{ 
                borderColor: secondaryColor,
                color: secondaryColor
              }}
            >
              View Events
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-6 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-8 md:gap-16">
            <button onClick={() => onNavigate('schedule')} className="text-center hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center gap-2 mb-1">
                <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>{courts.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Courts</p>
            </button>
            <button onClick={() => onNavigate('events')} className="text-center hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>{events.length}</span>
              </div>
              <p className="text-sm text-muted-foreground">Events</p>
            </button>
            {coaches.length > 0 && (
              <button onClick={() => onNavigate('coaching')} className="text-center hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Award className="w-5 h-5" style={{ color: primaryColor }} />
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>{coaches.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Coaches</p>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Featured Courts - Horizontal Scroll on Mobile */}
      {courts.length > 0 && (
        <section className="py-8 bg-background">
          <div className="px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ color: secondaryColor }}>Courts</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate('schedule')}
                className="text-sm"
                style={{ color: primaryColor }}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {courts.slice(0, 6).map((court) => (
                <Card 
                  key={court.id} 
                  className="flex-shrink-0 w-[200px] snap-start hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onNavigate('schedule')}
                >
                  <CardContent className="p-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="font-medium text-sm mb-1">{court.name}</h3>
                    {court.surface_type && (
                      <Badge variant="secondary" className="text-xs mb-2">{court.surface_type}</Badge>
                    )}
                    {court.hourly_rate && (
                      <p className="text-xs text-muted-foreground">${court.hourly_rate}/hr</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {events.length > 0 && (
        <section className="py-8 bg-muted/30">
          <div className="px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ color: secondaryColor }}>Upcoming Events</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate('events')}
                className="text-sm"
                style={{ color: primaryColor }}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {events.slice(0, 3).map((event) => (
                <Card 
                  key={event.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onRegisterEvent(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div 
                        className="flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center text-white"
                        style={{ backgroundColor: primaryColor }}
                      >
                        <span className="text-xs font-medium">
                          {format(new Date(event.start_time), 'MMM')}
                        </span>
                        <span className="text-lg font-bold leading-none">
                          {format(new Date(event.start_time), 'd')}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Badge 
                              variant="outline" 
                              className="text-xs mb-1"
                              style={{ borderColor: primaryColor, color: primaryColor }}
                            >
                              {event.event_type}
                            </Badge>
                            <h3 className="font-medium text-sm line-clamp-1">{event.title}</h3>
                          </div>
                          {event.price !== null && event.price > 0 && (
                            <span className="font-semibold text-sm" style={{ color: primaryColor }}>
                              ${event.price}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(event.start_time), 'h:mm a')}
                          </span>
                          {event.max_participants && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {event.current_participants}/{event.max_participants}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Coaches */}
      {coaches.length > 0 && (
        <section className="py-8 bg-background">
          <div className="px-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ color: secondaryColor }}>Our Coaches</h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate('coaching')}
                className="text-sm"
                style={{ color: primaryColor }}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {coaches.slice(0, 4).map((coach) => (
                <Card key={coach.id} className="flex-shrink-0 w-[160px] snap-start">
                  <CardContent className="p-4 text-center">
                    <div 
                      className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center overflow-hidden"
                      style={{ backgroundColor: `${secondaryColor}20` }}
                    >
                      {coach.avatar_url ? (
                        <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                      ) : (
                        <Star className="w-6 h-6" style={{ color: secondaryColor }} />
                      )}
                    </div>
                    <h3 className="font-medium text-sm mb-1 line-clamp-1">{coach.name}</h3>
                    {coach.hourly_rate && (
                      <p className="text-xs text-muted-foreground">${coach.hourly_rate}/hr</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Extra padding for bottom navigation */}
      <div className="h-8" />
    </div>
  );
}
