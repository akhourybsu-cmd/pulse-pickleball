import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Phone, Mail, Globe, Calendar, Clock, DollarSign, Users, Trophy, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { usePublicVenueDetails, PublicVenue } from '@/hooks/usePublicVenues';
import { CourtBookingDialog } from './CourtBookingDialog';
import { CreatePlayerBookingData } from '@/hooks/usePlayerBookings';
import { FavoriteButton } from './FavoriteButton';
import { useFavoriteVenues } from '@/hooks/useFavoriteVenues';

interface VenueDetailSheetProps {
  venueId: string | null;
  onClose: () => void;
  onBook: (data: CreatePlayerBookingData) => Promise<any>;
  onRegisterEvent: (eventId: string) => Promise<any>;
  isEventRegistered: (eventId: string) => boolean;
}

export function VenueDetailSheet({ venueId, onClose, onBook, onRegisterEvent, isEventRegistered }: VenueDetailSheetProps) {
  const navigate = useNavigate();
  const { venue, courts, events, coaches, loading } = usePublicVenueDetails(venueId);
  const { isFavorite, toggleFavorite } = useFavoriteVenues();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [registeringEvent, setRegisteringEvent] = useState<string | null>(null);

  const handleViewFullPage = () => {
    if (venue?.slug) {
      onClose();
      navigate(`/v/${venue.slug}`);
    }
  };
  const handleRegister = async (eventId: string) => {
    setRegisteringEvent(eventId);
    try {
      await onRegisterEvent(eventId);
    } finally {
      setRegisteringEvent(null);
    }
  };

  return (
    <>
      <Sheet open={!!venueId} onOpenChange={() => onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : venue ? (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {venue.logo_url ? (
                      <img src={venue.logo_url} alt={venue.name} className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-7 w-7 text-primary" />
                      </div>
                    )}
                    <div>
                      <SheetTitle className="text-xl">{venue.name}</SheetTitle>
                      {venue.city && venue.state && (
                        <SheetDescription>{venue.city}, {venue.state}</SheetDescription>
                      )}
                    </div>
                  </div>
                  <FavoriteButton
                    isFavorite={isFavorite(venue.id)}
                    onToggle={() => toggleFavorite(venue.id)}
                  />
                </div>
              </SheetHeader>

              {/* View Full Page Button */}
              {venue.slug && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mb-4"
                  onClick={handleViewFullPage}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Full Venue Page
                </Button>
              )}

              {venue.description && (
                <p className="text-sm text-muted-foreground mb-4">{venue.description}</p>
              )}

              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mb-6">
                {venue.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    <span>{venue.address}</span>
                  </div>
                )}
                {venue.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${venue.phone}`} className="hover:text-primary">{venue.phone}</a>
                  </div>
                )}
                {venue.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${venue.email}`} className="hover:text-primary">{venue.email}</a>
                  </div>
                )}
                {venue.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="h-4 w-4" />
                    <a href={venue.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">Website</a>
                  </div>
                )}
              </div>

              <Tabs defaultValue="courts" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="courts" className="flex-1">Courts</TabsTrigger>
                  <TabsTrigger value="events" className="flex-1">Events</TabsTrigger>
                  <TabsTrigger value="coaching" className="flex-1">Coaching</TabsTrigger>
                </TabsList>

                <TabsContent value="courts" className="mt-4 space-y-3">
                  {courts.length > 0 ? (
                    <>
                      <Button onClick={() => setBookingOpen(true)} className="w-full">
                        Reserve Court Time
                      </Button>
                      {courts.map(court => (
                        <Card key={court.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{court.name}</h4>
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
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No courts listed yet. Check back soon!</p>
                  )}
                </TabsContent>

                <TabsContent value="events" className="mt-4 space-y-3">
                  {events.length > 0 ? (
                    events.map(event => {
                      const registered = isEventRegistered(event.id);
                      const isFull = event.max_participants && event.current_participants >= event.max_participants;
                      
                      return (
                        <Card key={event.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium">{event.title}</h4>
                                <Badge variant="outline" className="text-xs mt-1">{event.event_type}</Badge>
                              </div>
                              {event.price && event.price > 0 && (
                                <Badge>${event.price}</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 mb-3">
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
                                  <span>{event.current_participants}/{event.max_participants} registered</span>
                                </div>
                              )}
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full"
                              variant={registered ? 'outline' : 'default'}
                              disabled={registered || registeringEvent === event.id}
                              onClick={() => handleRegister(event.id)}
                            >
                              {registered ? 'Registered' : isFull ? 'Join Waitlist' : 'Register'}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No upcoming events scheduled</p>
                  )}
                </TabsContent>

                <TabsContent value="coaching" className="mt-4 space-y-3">
                  {coaches.length > 0 ? (
                    coaches.map(coach => (
                      <Card key={coach.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {coach.avatar_url ? (
                              <img src={coach.avatar_url} alt={coach.name} className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Trophy className="h-6 w-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="font-medium">{coach.name}</h4>
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
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No coaching available at this time</p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">Venue not found</p>
          )}
        </SheetContent>
      </Sheet>

      {venue && (
        <CourtBookingDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          venue={venue}
          courts={courts}
          onBook={onBook}
        />
      )}
    </>
  );
}
