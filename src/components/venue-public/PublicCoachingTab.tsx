import { Star, Mail, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PublicVenue, VenueCoach } from '@/hooks/usePublicVenue';

interface PublicCoachingTabProps {
  venue: PublicVenue;
  coaches: VenueCoach[];
  onBookCoach: (coach: VenueCoach) => void;
}

export function PublicCoachingTab({ venue, coaches, onBookCoach }: PublicCoachingTabProps) {
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  if (coaches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4">
        <Star className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Coaches Available</h3>
        <p className="text-muted-foreground text-center">
          This venue doesn't have any coaches listed at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-4">
        <h2 className="text-xl font-semibold" style={{ color: secondaryColor }}>
          Our Coaches
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Book a lesson with one of our certified professionals
        </p>
      </div>

      {/* Coaches List */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-4">
          {coaches.map((coach) => (
            <Card key={coach.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Avatar */}
                  <div 
                    className="flex-shrink-0 w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: `${secondaryColor}15` }}
                  >
                    {coach.avatar_url ? (
                      <img 
                        src={coach.avatar_url} 
                        alt={coach.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <Star className="w-8 h-8" style={{ color: secondaryColor }} />
                    )}
                  </div>
                  
                  {/* Coach Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1">{coach.name}</h3>
                    
                    {coach.hourly_rate && (
                      <div className="flex items-center gap-1 text-sm mb-2" style={{ color: primaryColor }}>
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">${coach.hourly_rate}/hour</span>
                      </div>
                    )}
                    
                    {coach.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {coach.bio}
                      </p>
                    )}
                    
                    {coach.specialties && coach.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {coach.specialties.map((specialty, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => onBookCoach(coach)}
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Book Lesson
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Extra padding */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}
