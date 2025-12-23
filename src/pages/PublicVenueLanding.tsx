import { useParams, Link } from 'react-router-dom';
import { usePublicVenue } from '@/hooks/usePublicVenue';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Users, 
  Calendar, 
  ChevronRight,
  Zap,
  Star,
  Award,
  Instagram,
  Facebook
} from 'lucide-react';
import { format } from 'date-fns';

export default function PublicVenueLanding() {
  const { slug } = useParams<{ slug: string }>();
  const { venue, courts, events, coaches, loading, error } = usePublicVenue(slug);

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

  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  return (
    <div 
      className="min-h-screen"
      style={{
        '--venue-primary': primaryColor,
        '--venue-secondary': secondaryColor,
      } as React.CSSProperties}
    >
      {/* Hero Section */}
      <section 
        className="relative min-h-[60vh] flex items-center justify-center overflow-hidden"
        style={{
          background: venue.banner_url 
            ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${venue.banner_url}) center/cover`
            : `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}30)`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {venue.logo_url && (
            <img 
              src={venue.logo_url} 
              alt={venue.name}
              className="h-24 w-24 md:h-32 md:w-32 mx-auto mb-6 rounded-2xl shadow-xl object-cover bg-white"
            />
          )}
          
          <h1 
            className="text-4xl md:text-6xl font-bold mb-4"
            style={{ color: venue.banner_url ? 'white' : secondaryColor }}
          >
            {venue.name}
          </h1>
          
          {venue.tagline && (
            <p 
              className="text-xl md:text-2xl mb-8 opacity-90"
              style={{ color: venue.banner_url ? 'white' : secondaryColor }}
            >
              {venue.tagline}
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8"
              style={{ 
                backgroundColor: primaryColor, 
                color: 'white',
                borderColor: primaryColor 
              }}
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book a Court
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 bg-white/90 hover:bg-white"
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
      <section className="py-8 bg-card border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <StatItem icon={MapPin} value={courts.length} label="Courts" color={primaryColor} />
            <StatItem icon={Calendar} value={events.length} label="Upcoming Events" color={primaryColor} />
            <StatItem icon={Award} value={coaches.length} label="Pro Coaches" color={primaryColor} />
          </div>
        </div>
      </section>

      {/* Courts Section */}
      {courts.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <SectionHeader 
              title="Our Courts" 
              subtitle="Premium playing surfaces for every skill level"
              color={secondaryColor}
            />
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {courts.map((court) => (
                <Card key={court.id} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/30">
                  <CardContent className="p-6">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${primaryColor}20` }}
                    >
                      <MapPin className="w-6 h-6" style={{ color: primaryColor }} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{court.name}</h3>
                    {court.surface_type && (
                      <Badge variant="secondary" className="mb-3">{court.surface_type}</Badge>
                    )}
                    {court.hourly_rate && (
                      <p className="text-muted-foreground">
                        ${court.hourly_rate}/hour
                      </p>
                    )}
                    <Button 
                      variant="ghost" 
                      className="w-full mt-4 group-hover:bg-primary/10"
                      style={{ color: primaryColor }}
                    >
                      Reserve <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Events Section */}
      {events.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <SectionHeader 
              title="Upcoming Events" 
              subtitle="Join our community programs and tournaments"
              color={secondaryColor}
            />
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-all duration-300">
                  <div 
                    className="h-2"
                    style={{ backgroundColor: primaryColor }}
                  />
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <Badge 
                          variant="outline" 
                          className="mb-2"
                          style={{ borderColor: primaryColor, color: primaryColor }}
                        >
                          {event.event_type}
                        </Badge>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                      </div>
                      {event.price !== null && event.price > 0 && (
                        <span className="font-bold text-lg" style={{ color: primaryColor }}>
                          ${event.price}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(event.start_time), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                      </div>
                      {event.max_participants && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {event.current_participants}/{event.max_participants} spots filled
                        </div>
                      )}
                    </div>
                    
                    {event.skill_level && (
                      <Badge variant="secondary" className="mb-4">{event.skill_level}</Badge>
                    )}
                    
                    <Button 
                      className="w-full"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Register Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coaches Section */}
      {coaches.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <SectionHeader 
              title="Meet Our Coaches" 
              subtitle="Learn from certified professionals"
              color={secondaryColor}
            />
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coaches.map((coach) => (
                <Card key={coach.id} className="hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-6 text-center">
                    <div 
                      className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{ backgroundColor: `${secondaryColor}20` }}
                    >
                      <Star className="w-10 h-10" style={{ color: secondaryColor }} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{coach.name}</h3>
                    {coach.bio && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{coach.bio}</p>
                    )}
                    {coach.specialties && coach.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-center mb-4">
                        {coach.specialties.slice(0, 3).map((specialty, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{specialty}</Badge>
                        ))}
                      </div>
                    )}
                    {coach.hourly_rate && (
                      <p className="text-sm text-muted-foreground mb-4">
                        ${coach.hourly_rate}/hour
                      </p>
                    )}
                    <Button 
                      variant="outline"
                      className="w-full"
                      style={{ borderColor: primaryColor, color: primaryColor }}
                    >
                      Book Lesson
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About & Contact Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            {/* About */}
            <div>
              <h2 
                className="text-2xl font-bold mb-6"
                style={{ color: secondaryColor }}
              >
                About {venue.name}
              </h2>
              {venue.description && (
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  {venue.description}
                </p>
              )}
              
              {venue.amenities && venue.amenities.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {venue.amenities.map((amenity, i) => (
                      <Badge key={i} variant="outline">{amenity}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Contact Info */}
            <div>
              <h2 
                className="text-2xl font-bold mb-6"
                style={{ color: secondaryColor }}
              >
                Visit Us
              </h2>
              
              <div className="space-y-4">
                {(venue.address || venue.city) && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 mt-0.5" style={{ color: primaryColor }} />
                    <div>
                      {venue.address && <p>{venue.address}</p>}
                      {venue.city && venue.state && (
                        <p>{venue.city}, {venue.state} {venue.zip_code}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {venue.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5" style={{ color: primaryColor }} />
                    <a href={`tel:${venue.phone}`} className="hover:underline">{venue.phone}</a>
                  </div>
                )}
                
                {venue.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5" style={{ color: primaryColor }} />
                    <a href={`mailto:${venue.email}`} className="hover:underline">{venue.email}</a>
                  </div>
                )}
                
                {venue.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5" style={{ color: primaryColor }} />
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {venue.website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                
                {/* Social Links */}
                <div className="flex gap-4 pt-4">
                  {venue.social_facebook && (
                    <a 
                      href={venue.social_facebook} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <Facebook className="w-6 h-6" style={{ color: primaryColor }} />
                    </a>
                  )}
                  {venue.social_instagram && (
                    <a 
                      href={venue.social_instagram} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-muted transition-colors"
                    >
                      <Instagram className="w-6 h-6" style={{ color: primaryColor }} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Powered by Pulse Footer */}
      {venue.show_pulse_branding !== false && (
        <footer className="py-6 bg-card border-t border-border">
          <div className="container mx-auto px-4 text-center">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Zap className="w-4 h-4" />
              Powered by Pulse
            </Link>
          </div>
        </footer>
      )}
      
      {/* Minimal footer when branding is hidden */}
      {venue.show_pulse_branding === false && (
        <footer className="py-4 bg-card border-t border-border">
          <div className="container mx-auto px-4 text-center">
            <p className="text-xs text-muted-foreground/50">
              <Zap className="w-3 h-3 inline mr-1" />
              Powered by Pulse
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}

function SectionHeader({ title, subtitle, color }: { title: string; subtitle: string; color: string }) {
  return (
    <div className="text-center mb-12">
      <h2 className="text-3xl font-bold mb-3" style={{ color }}>{title}</h2>
      <p className="text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
    </div>
  );
}

function StatItem({ icon: Icon, value, label, color }: { icon: any; value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Icon className="w-5 h-5" style={{ color }} />
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-[60vh] bg-muted animate-pulse" />
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    </div>
  );
}
