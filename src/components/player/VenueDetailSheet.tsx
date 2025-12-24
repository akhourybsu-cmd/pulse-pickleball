import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Phone, Mail, Globe, Calendar, Clock, DollarSign, Users, Trophy, ExternalLink, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { usePublicVenueDetails } from '@/hooks/usePublicVenues';
import { FavoriteButton } from './FavoriteButton';
import { useFavoriteVenues } from '@/hooks/useFavoriteVenues';

interface VenueDetailSheetProps {
  venueId: string | null;
  onClose: () => void;
}

export function VenueDetailSheet({ venueId, onClose }: VenueDetailSheetProps) {
  const navigate = useNavigate();
  const { venue, courts, events, coaches, loading } = usePublicVenueDetails(venueId);
  const { isFavorite, toggleFavorite } = useFavoriteVenues();

  // Navigation helper - routes to full venue page with tab pre-selected
  const navigateToVenue = (tab?: string, entityId?: string) => {
    if (!venue?.slug) return;
    let path = `/v/${venue.slug}`;
    const params = new URLSearchParams();
    if (tab) params.set('tab', tab);
    if (entityId) params.set('eventId', entityId);
    if (params.toString()) path += `?${params.toString()}`;
    onClose();
    navigate(path);
  };

  // Get brand colors with fallbacks
  const primaryColor = venue?.primary_color || '#FF6B35';
  const secondaryColor = venue?.secondary_color || '#004E64';

  // Generate venue initials for fallback
  const venueInitials = venue?.name
    ? venue.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'V';

  return (
    <Sheet open={!!venueId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-24 w-24 mx-auto rounded-xl" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : venue ? (
          <>
            {/* VENUE HEADER WITH BRANDING */}
            <div 
              className="relative px-6 pt-8 pb-6"
              style={{ 
                background: `linear-gradient(135deg, ${secondaryColor}15 0%, ${primaryColor}10 100%)` 
              }}
            >
              {/* Favorite Button - Top Right */}
              <div className="absolute top-4 right-4">
                <FavoriteButton
                  isFavorite={isFavorite(venue.id)}
                  onToggle={() => toggleFavorite(venue.id)}
                />
              </div>

              {/* PROMINENT LOGO */}
              <div className="flex flex-col items-center text-center">
                {venue.logo_url ? (
                  <img 
                    src={venue.logo_url} 
                    alt={venue.name} 
                    className="h-20 w-auto max-w-[180px] object-contain mb-4"
                  />
                ) : (
                  <div 
                    className="h-20 w-20 rounded-xl flex items-center justify-center mb-4 text-2xl font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {venueInitials}
                  </div>
                )}
                
                <h2 className="text-xl font-bold text-foreground">{venue.name}</h2>
                {venue.city && venue.state && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {venue.city}, {venue.state}
                  </p>
                )}
              </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="px-6 pb-6">
              {/* Description */}
              {venue.description && (
                <p className="text-sm text-muted-foreground mb-4">{venue.description}</p>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-6">
                {venue.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{venue.address}</span>
                  </div>
                )}
                {venue.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    <a href={`tel:${venue.phone}`} className="hover:text-foreground transition-colors">{venue.phone}</a>
                  </div>
                )}
                {venue.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${venue.email}`} className="hover:text-foreground transition-colors">{venue.email}</a>
                  </div>
                )}
                {venue.website && (
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Website</a>
                  </div>
                )}
              </div>

              {/* TABS - PREVIEW ONLY */}
              <Tabs defaultValue="courts" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger 
                    value="courts" 
                    className="flex-1 data-[state=active]:text-primary"
                    style={{ '--tw-text-opacity': 1 } as React.CSSProperties}
                  >
                    Courts
                  </TabsTrigger>
                  <TabsTrigger 
                    value="events" 
                    className="flex-1 data-[state=active]:text-primary"
                  >
                    Events
                  </TabsTrigger>
                  <TabsTrigger 
                    value="coaching" 
                    className="flex-1 data-[state=active]:text-primary"
                  >
                    Coaching
                  </TabsTrigger>
                </TabsList>

                {/* COURTS TAB - PREVIEW ONLY */}
                <TabsContent value="courts" className="mt-4 space-y-3">
                  {courts.length > 0 ? (
                    <>
                      {courts.slice(0, 3).map(court => (
                        <Card key={court.id} className="border-border/50">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium text-foreground">{court.name}</h4>
                                <p className="text-sm text-muted-foreground">Court {court.court_number}</p>
                              </div>
                              <div className="text-right">
                                {court.hourly_rate && (
                                  <Badge variant="secondary">${court.hourly_rate}/hr</Badge>
                                )}
                                {court.surface_type && (
                                  <p className="text-xs text-muted-foreground mt-1">{court.surface_type}</p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {courts.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{courts.length - 3} more courts
                        </p>
                      )}
                      {/* NAVIGATION CTA - NO TRANSACTION */}
                      <Button 
                        onClick={() => navigateToVenue('schedule')} 
                        className="w-full mt-2"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Reserve Court Time
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No courts listed yet</p>
                  )}
                </TabsContent>

                {/* EVENTS TAB - PREVIEW ONLY */}
                <TabsContent value="events" className="mt-4 space-y-3">
                  {events.length > 0 ? (
                    <>
                      {events.slice(0, 3).map(event => (
                        <Card 
                          key={event.id} 
                          className="border-border/50 cursor-pointer hover:border-border transition-colors"
                          onClick={() => navigateToVenue('events', event.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium text-foreground">{event.title}</h4>
                                <Badge variant="outline" className="text-xs mt-1">{event.event_type}</Badge>
                              </div>
                              {event.price && event.price > 0 && (
                                <Badge>${event.price}</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                <span>{format(new Date(event.start_time), 'MMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>{format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}</span>
                              </div>
                              {event.max_participants && (
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3" />
                                  <span>{event.current_participants}/{event.max_participants} spots filled</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {events.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{events.length - 3} more events
                        </p>
                      )}
                      {/* NAVIGATION CTA - NO TRANSACTION */}
                      <Button 
                        variant="outline"
                        onClick={() => navigateToVenue('events')} 
                        className="w-full mt-2"
                      >
                        View Event Details
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No upcoming events scheduled</p>
                  )}
                </TabsContent>

                {/* COACHING TAB - PREVIEW ONLY */}
                <TabsContent value="coaching" className="mt-4 space-y-3">
                  {coaches.length > 0 ? (
                    <>
                      {coaches.slice(0, 3).map(coach => (
                        <Card key={coach.id} className="border-border/50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {coach.avatar_url ? (
                                <img src={coach.avatar_url} alt={coach.name} className="h-12 w-12 rounded-full object-cover" />
                              ) : (
                                <div 
                                  className="h-12 w-12 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: `${primaryColor}20` }}
                                >
                                  <Trophy className="h-6 w-6" style={{ color: primaryColor }} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-foreground">{coach.name}</h4>
                                {coach.bio && <p className="text-sm text-muted-foreground line-clamp-2">{coach.bio}</p>}
                                {coach.specialties && coach.specialties.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {coach.specialties.slice(0, 3).map((s, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {coach.hourly_rate && (
                                <Badge variant="secondary">${coach.hourly_rate}/hr</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {coaches.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{coaches.length - 3} more coaches
                        </p>
                      )}
                      {/* NAVIGATION CTA - NO TRANSACTION */}
                      <Button 
                        variant="outline"
                        onClick={() => navigateToVenue('coaching')} 
                        className="w-full mt-2"
                      >
                        Learn More About Coaching
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No coaching available at this time</p>
                  )}
                </TabsContent>
              </Tabs>

              {/* PERSISTENT FOOTER CTA */}
              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  onClick={() => navigateToVenue()} 
                  className="w-full"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Full Venue Page
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6">
            <p className="text-center text-muted-foreground py-8">Venue not found</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
