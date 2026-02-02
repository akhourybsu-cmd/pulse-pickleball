import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Check } from "lucide-react";
import { motion } from "framer-motion";
import { sanitizeMapEmbed } from "@/lib/mapEmbedSanitizer";

interface VenueDetail {
  text: string;
}

interface TournamentVenueModuleProps {
  location: string;
  mapEmbed: string | null;
  venuePhotoUrl: string | null;
  venueDetails: VenueDetail[] | null;
}

export function TournamentVenueModule({ 
  location,
  mapEmbed, 
  venuePhotoUrl, 
  venueDetails 
}: TournamentVenueModuleProps) {
  if (!mapEmbed && !venuePhotoUrl && !venueDetails?.length) return null;

  const sanitizedEmbed = mapEmbed ? sanitizeMapEmbed(mapEmbed) : null;

  const handleGetDirections = () => {
    const encodedLocation = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedLocation}`, "_blank");
  };

  return (
    <section className="py-16 md:py-24 px-4 bg-secondary">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-secondary-foreground mb-3">
            The Venue
          </h2>
          <p className="text-secondary-foreground/70 text-lg flex items-center justify-center gap-2">
            <MapPin className="h-5 w-5" />
            {location}
          </p>
        </motion.div>

        <Card className="overflow-hidden border-0 shadow-2xl">
          {/* Hero Image */}
          {venuePhotoUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="relative aspect-video md:aspect-[21/9]"
            >
              <img 
                src={venuePhotoUrl}
                alt="Venue"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </motion.div>
          )}

          <CardContent className="p-6 md:p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Venue Features */}
              {venueDetails && venueDetails.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-semibold text-foreground mb-4">Amenities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {venueDetails.map((detail, i) => (
                      <div 
                        key={i} 
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-foreground text-sm">{detail.text}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Map Embed or Actions */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="space-y-4"
              >
              {sanitizedEmbed && (
                  <div 
                    className="rounded-xl overflow-hidden shadow-lg h-[180px] md:h-[250px]"
                    dangerouslySetInnerHTML={{ __html: sanitizedEmbed }}
                  />
                )}
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      const encodedLocation = encodeURIComponent(location);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`, "_blank");
                    }}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    View Map
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleGetDirections}
                  >
                    <Navigation className="h-4 w-4 mr-2" />
                    Get Directions
                  </Button>
                </div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
