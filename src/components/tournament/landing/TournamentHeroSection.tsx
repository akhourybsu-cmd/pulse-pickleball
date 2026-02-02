import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Share2, ChevronDown } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { motion, useScroll, useTransform } from "framer-motion";

interface TournamentEvent {
  id: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  registration_close_date: string | null;
  registration_fee: number;
}

interface TournamentCustomization {
  hero_image_url: string | null;
  hero_overlay_color: string | null;
  tagline: string | null;
}

interface TournamentHeroSectionProps {
  event: TournamentEvent;
  customization: TournamentCustomization | null;
  onRegister: () => void;
  onShare: () => void;
}

export function TournamentHeroSection({ 
  event, 
  customization, 
  onRegister, 
  onShare 
}: TournamentHeroSectionProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollY } = useScroll();
  const backgroundY = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  const now = new Date();
  const closeDate = event.registration_close_date ? new Date(event.registration_close_date) : null;
  const daysUntilClose = closeDate ? differenceInDays(closeDate, now) : null;
  const isClosed = closeDate && closeDate < now;
  const isClosingSoon = daysUntilClose !== null && daysUntilClose > 0 && daysUntilClose <= 7;

  const getStatusBadge = () => {
    if (isClosed) {
      return (
        <Badge variant="outline" className="bg-muted/80 backdrop-blur-sm text-muted-foreground border-muted-foreground/30">
          Registration Closed
        </Badge>
      );
    }
    if (isClosingSoon) {
      return (
        <Badge className="bg-orange-500/90 backdrop-blur-sm text-white border-0 shadow-lg shadow-orange-500/25">
          {daysUntilClose} {daysUntilClose === 1 ? "Day" : "Days"} Left
        </Badge>
      );
    }
    return (
      <Badge className="bg-green-500/90 backdrop-blur-sm text-white border-0 shadow-lg shadow-green-500/30">
        Registration Open
      </Badge>
    );
  };

  const overlayGradient = customization?.hero_overlay_color === 'dark-teal-overlay' 
    ? 'linear-gradient(to bottom, rgba(14,57,68,0.4) 0%, rgba(14,57,68,0.85) 100%)'
    : customization?.hero_overlay_color === 'teal'
    ? 'linear-gradient(135deg, rgba(14,57,68,0.85), rgba(14,57,68,0.95))'
    : 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%)';

  return (
    <section 
      ref={containerRef}
      className="relative min-h-[70vh] md:min-h-screen flex items-end md:items-center justify-center overflow-hidden"
    >
      {/* Parallax Background */}
      <motion.div 
        style={{ y: backgroundY }}
        className="absolute inset-0 -top-[50px]"
      >
        {customization?.hero_image_url ? (
          <div 
            className="absolute inset-0 bg-cover bg-center scale-110"
            style={{ 
              backgroundImage: `url(${customization.hero_image_url})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent" />
        )}
      </motion.div>
      
      {/* Gradient Overlay */}
      <div 
        className="absolute inset-0"
        style={{ background: overlayGradient }}
      />

      {/* Content */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 w-full px-4 pb-8 md:pb-0"
      >
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-center text-white space-y-4 md:space-y-6"
          >
            {/* Status Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              {getStatusBadge()}
            </motion.div>

            {/* Tournament Name */}
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight drop-shadow-2xl px-2">
              {event.name}
            </h1>

            {/* Tagline */}
            {customization?.tagline && (
              <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
                {customization.tagline}
              </p>
            )}

            {/* Date & Location */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span className="text-lg">
                  {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <span className="text-lg">{event.location}</span>
              </div>
            </div>

            {/* Countdown if closing soon */}
            {isClosingSoon && daysUntilClose !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-orange-500/20 backdrop-blur-sm border border-orange-400/30 rounded-xl px-6 py-3 inline-block"
              >
                <span className="text-orange-200 font-medium">
                  ⏰ Registration closes in {daysUntilClose} {daysUntilClose === 1 ? "day" : "days"}
                </span>
              </motion.div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                onClick={onRegister}
                disabled={isClosed}
                className="w-full sm:w-auto text-lg px-8 py-6 bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-[1.02] transition-all duration-300"
              >
                {isClosed ? "Registration Closed" : (
                  <>
                    Register Now
                    {event.registration_fee > 0 && (
                      <span className="ml-2 opacity-90">${event.registration_fee}</span>
                    )}
                  </>
                )}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onShare}
                className="w-full sm:w-auto text-lg px-6 py-6 bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50 transition-all duration-300"
              >
                <Share2 className="h-5 w-5 mr-2" />
                Share
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 flex flex-col items-center gap-1 hidden md:flex"
      >
        <span className="text-xs uppercase tracking-wider">Scroll for details</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.div>
    </section>
  );
}
