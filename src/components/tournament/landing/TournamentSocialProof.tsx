import { Users, TrendingUp, Calendar, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import CountUp from "react-countup";

interface TournamentSocialProofProps {
  eventId: string;
  eventName: string;
  registeredCount?: number;
  startDate: string;
  onShare: () => void;
}

export function TournamentSocialProof({ 
  eventId, 
  eventName,
  registeredCount = 0,
  startDate,
  onShare 
}: TournamentSocialProofProps) {
  const handleAddToCalendar = () => {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + 1);
    
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName)}&dates=${startDateObj.toISOString().replace(/[-:]/g, "").split(".")[0]}Z/${endDateObj.toISOString().replace(/[-:]/g, "").split(".")[0]}Z&details=${encodeURIComponent(`Tournament: ${eventName}`)}&sf=true`;
    
    window.open(googleCalendarUrl, "_blank");
  };

  return (
    <section className="py-12 md:py-16 px-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center space-y-8"
        >
          {/* Registration Momentum */}
          {registeredCount > 0 && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium uppercase tracking-wider">
                  Growing Fast
                </span>
              </div>
              <p className="text-3xl md:text-4xl font-bold text-foreground">
                <CountUp end={registeredCount} duration={2} /> teams already registered
              </p>
              <p className="text-muted-foreground">
                Join the competition and secure your spot
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handleAddToCalendar}
              className="w-full sm:w-auto"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Add to Calendar
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={onShare}
              className="w-full sm:w-auto"
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share with Friends
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-8 pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Powered by PULSE</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
