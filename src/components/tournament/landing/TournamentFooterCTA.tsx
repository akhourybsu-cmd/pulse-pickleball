import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface TournamentFooterCTAProps {
  userId: string | null;
  eventId: string;
  isClosed?: boolean;
}

export function TournamentFooterCTA({ userId, eventId, isClosed = false }: TournamentFooterCTAProps) {
  const navigate = useNavigate();

  return (
    <section className="relative py-16 md:py-28 px-4 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-[gradient_8s_ease_infinite]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="container mx-auto max-w-3xl relative z-10 text-center"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white drop-shadow-lg mb-3 md:mb-4">
          Ready to Rally?
        </h2>
        <p className="text-base md:text-xl text-white/90 mb-6 md:mb-8 max-w-2xl mx-auto px-2">
          {isClosed 
            ? "Registration is closed, but you can still create your PULSE profile for future events."
            : "Secure your spot and join the competition. Create your free PULSE profile to register."
          }
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {!isClosed && (
            <Button
              size="lg"
              onClick={() => navigate(`/tournament/${eventId}/register`)}
              className="bg-white text-primary hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 text-base md:text-lg px-6 md:px-10 py-5 md:py-6"
            >
              Register Now
            </Button>
          )}
          
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate(userId ? "/player/dashboard" : "/auth")}
            className="border-white/50 text-white hover:bg-white/20 hover:border-white transition-all duration-300 text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
          >
            {userId ? "Go to Dashboard" : "Create Free Profile"}
          </Button>
        </div>

        {!userId && (
          <button
            onClick={() => navigate("/auth")}
            className="mt-6 text-white/80 hover:text-white underline transition-colors text-sm"
          >
            I Already Have an Account
          </button>
        )}
      </motion.div>
    </section>
  );
}
