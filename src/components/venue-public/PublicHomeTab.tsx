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
  Star,
  ArrowLeft,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { PublicVenue, VenueCourt, VenueEvent, VenueCoach } from '@/hooks/usePublicVenue';
import { TabId } from './PublicVenueShell';
import { getVenueLogoSrc, getVenueLogoFallback, DEFAULT_VENUE_COLORS } from '@/lib/venueBranding';
import { FollowButton } from '@/components/venue/FollowButton';
import { useVenueCommunityGroup } from '@/hooks/useVenueCommunityGroup';

interface PublicHomeTabProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  events: VenueEvent[];
  coaches: VenueCoach[];
  onNavigate: (tab: TabId) => void;
  onRegisterEvent: (event: VenueEvent) => void;
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

export function PublicHomeTab({ 
  venue, 
  courts, 
  events, 
  coaches, 
  onNavigate,
  onRegisterEvent
}: PublicHomeTabProps) {
  const navigate = useNavigate();
  const primaryColor = venue.primary_color || DEFAULT_VENUE_COLORS.primary;
  const secondaryColor = venue.secondary_color || DEFAULT_VENUE_COLORS.secondary;
  
  // Fetch venue's official community group
  const { group: venueGroup } = useVenueCommunityGroup(venue.id);

  return (
    <div className="space-y-0">
      {/* Hero Section - Dark Premium Background */}
      <section 
        className="relative min-h-[50vh] flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, #121212, #1A1A1A, #222222)'
        }}
      >
        {/* Back navigation and Follow button */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <motion.button 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            onClick={() => navigate('/')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </motion.button>
          
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <FollowButton 
              venueId={venue.id} 
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            />
          </motion.div>
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          {/* Logo as primary hero element with scale-in animation */}
          <motion.img 
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            src={getVenueLogoSrc(venue.logo_url, venue.name, venue.slug)} 
            alt={venue.name}
            className="mx-auto mb-4 object-contain"
            style={{
              maxHeight: '100px',
              maxWidth: '320px',
              width: 'auto',
              height: 'auto',
            }}
            onError={(e) => {
              e.currentTarget.src = getVenueLogoFallback();
            }}
          />

          {/* Tagline with fade-in */}
          {venue.tagline && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-base md:text-lg mb-6 text-white/80"
            >
              {venue.tagline}
            </motion.p>
          )}
          
          {/* CTA buttons with staggered fade-up */}
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { 
                opacity: 1,
                transition: { staggerChildren: 0.15, delayChildren: 0.4 }
              }
            }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <motion.div variants={fadeInUp}>
              <Button 
                size="lg" 
                className="text-base px-6 w-full sm:w-auto"
                onClick={() => onNavigate('schedule')}
                style={{ 
                  backgroundColor: primaryColor, 
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                }}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Book a Court
              </Button>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Button 
                size="lg" 
                variant="outline"
                className="text-base px-6 border-white/60 text-white bg-transparent hover:bg-white/10 w-full sm:w-auto"
                onClick={() => onNavigate('events')}
              >
                View Events
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Quick Stats with CountUp animation */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
        className="py-6 bg-card border-b border-border"
      >
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-8 md:gap-16">
            <button onClick={() => onNavigate('schedule')} className="text-center hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center gap-2 mb-1">
                <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                  <CountUp end={courts.length} duration={1.5} />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Courts</p>
            </button>
            <button onClick={() => onNavigate('events')} className="text-center hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Calendar className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                  <CountUp end={events.length} duration={1.5} />
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Events</p>
            </button>
            {coaches.length > 0 && (
              <button onClick={() => onNavigate('coaching')} className="text-center hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Award className="w-5 h-5" style={{ color: primaryColor }} />
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                    <CountUp end={coaches.length} duration={1.5} />
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Coaches</p>
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* Join Community CTA */}
      {venueGroup && (
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="py-6 px-4"
        >
          <Card 
            className="border-2 cursor-pointer hover:shadow-lg transition-all duration-300"
            style={{ borderColor: `${primaryColor}30` }}
            onClick={() => navigate(`/player/community/group/${venueGroup.id}`)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${primaryColor}15` }}
              >
                <MessageSquare className="w-6 h-6" style={{ color: primaryColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">Join Our Community</h3>
                <p className="text-xs text-muted-foreground">
                  Connect with {venueGroup.member_count || 0}+ players
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </motion.section>
      )}

      {/* Featured Courts - Staggered card reveal */}
      {courts.length > 0 && (
        <section className="py-8 bg-background">
          <div className="px-4">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between mb-4"
            >
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
            </motion.div>
            
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
            >
              {courts.slice(0, 6).map((court) => (
                <motion.div key={court.id} variants={cardVariant}>
                  <Card 
                    className="flex-shrink-0 w-[200px] snap-start hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Upcoming Events - Staggered card reveal */}
      {events.length > 0 && (
        <section className="py-8 bg-muted/30">
          <div className="px-4">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between mb-4"
            >
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
            </motion.div>
            
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="space-y-3"
            >
              {events.slice(0, 3).map((event) => (
                <motion.div key={event.id} variants={cardVariant}>
                  <Card 
                    className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Featured Coaches - Staggered card reveal */}
      {coaches.length > 0 && (
        <section className="py-8 bg-background">
          <div className="px-4">
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="flex items-center justify-between mb-4"
            >
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
            </motion.div>
            
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide"
            >
              {coaches.slice(0, 4).map((coach) => (
                <motion.div key={coach.id} variants={cardVariant}>
                  <Card className="flex-shrink-0 w-[160px] snap-start hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
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
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Extra padding for bottom navigation */}
      <div className="h-8" />
    </div>
  );
}
