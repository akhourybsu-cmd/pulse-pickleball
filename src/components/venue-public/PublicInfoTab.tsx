import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock,
  Instagram,
  Facebook,
  Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PublicVenue } from '@/hooks/usePublicVenue';

interface PublicInfoTabProps {
  venue: PublicVenue;
}

const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function PublicInfoTab({ venue }: PublicInfoTabProps) {
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
  };

  return (
    <ScrollArea className="h-full">
      <div className="px-4 py-6 space-y-6">
        {/* About Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4" style={{ color: secondaryColor }}>
            About {venue.name}
          </h2>
          
          {venue.description ? (
            <p className="text-muted-foreground leading-relaxed">
              {venue.description}
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              No description available.
            </p>
          )}
        </section>

        <Separator />

        {/* Contact Information */}
        <section>
          <h2 className="text-xl font-semibold mb-4" style={{ color: secondaryColor }}>
            Contact & Location
          </h2>
          
          <div className="space-y-4">
            {(venue.address || venue.city) && (
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="font-medium mb-0.5">Address</p>
                  {venue.address && <p className="text-muted-foreground">{venue.address}</p>}
                  {venue.city && venue.state && (
                    <p className="text-muted-foreground">
                      {venue.city}, {venue.state} {venue.zip_code}
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {venue.phone && (
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Phone className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="font-medium mb-0.5">Phone</p>
                  <a 
                    href={`tel:${venue.phone}`} 
                    className="text-muted-foreground hover:underline"
                  >
                    {venue.phone}
                  </a>
                </div>
              </div>
            )}
            
            {venue.email && (
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Mail className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="font-medium mb-0.5">Email</p>
                  <a 
                    href={`mailto:${venue.email}`} 
                    className="text-muted-foreground hover:underline"
                  >
                    {venue.email}
                  </a>
                </div>
              </div>
            )}
            
            {venue.website && (
              <div className="flex items-start gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Globe className="w-5 h-5" style={{ color: primaryColor }} />
                </div>
                <div>
                  <p className="font-medium mb-0.5">Website</p>
                  <a 
                    href={venue.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:underline"
                  >
                    {venue.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              </div>
            )}
            
            {/* Social Links */}
            {(venue.social_facebook || venue.social_instagram) && (
              <div className="flex gap-3 pt-2">
                {venue.social_facebook && (
                  <a 
                    href={venue.social_facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl hover:bg-muted transition-colors"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <Facebook className="w-6 h-6" style={{ color: primaryColor }} />
                  </a>
                )}
                {venue.social_instagram && (
                  <a 
                    href={venue.social_instagram} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-3 rounded-xl hover:bg-muted transition-colors"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <Instagram className="w-6 h-6" style={{ color: primaryColor }} />
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        <Separator />

        {/* Hours of Operation */}
        {venue.hours_of_operation && Object.keys(venue.hours_of_operation).length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4" style={{ color: secondaryColor }}>
              Hours of Operation
            </h2>
            
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {dayOrder.map((day) => {
                    const hours = venue.hours_of_operation?.[day];
                    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                    const isToday = day === today;
                    
                    return (
                      <div 
                        key={day} 
                        className={`flex items-center justify-between py-2 ${isToday ? 'font-medium' : ''}`}
                      >
                        <span className="capitalize flex items-center gap-2">
                          {day}
                          {isToday && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
                            >
                              Today
                            </Badge>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {hours 
                            ? `${formatTime(hours.open)} - ${formatTime(hours.close)}`
                            : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Amenities */}
        {venue.amenities && venue.amenities.length > 0 && (
          <>
            <Separator />
            <section>
              <h2 className="text-xl font-semibold mb-4" style={{ color: secondaryColor }}>
                Amenities
              </h2>
              
              <div className="grid grid-cols-2 gap-3">
                {venue.amenities.map((amenity, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2 p-3 rounded-lg"
                    style={{ backgroundColor: `${primaryColor}08` }}
                  >
                    <Check className="w-4 h-4" style={{ color: primaryColor }} />
                    <span className="text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Extra padding */}
        <div className="h-16" />
      </div>
    </ScrollArea>
  );
}
