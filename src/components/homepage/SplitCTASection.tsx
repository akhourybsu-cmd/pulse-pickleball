import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * Final CTA section at the bottom of the homepage.
 *
 * Player-first refocus: single prominent CTA for the player path, with a
 * quiet venue/organizer link underneath. Matches the hero's pattern so the
 * page has a consistent "this is for players" message throughout.
 */
export const SplitCTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Ready to start tracking your play?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join PULSE and start logging matches, joining round robins, and tracking your rating.
          </p>

          {/* Single primary player CTA */}
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="group h-14 px-10 text-lg font-semibold bg-gradient-to-r from-primary to-primary/85 hover:shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all duration-300"
          >
            Create your free account
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          {/* Quiet venue link — secondary path, NOT co-equal */}
          <div className="mt-6">
            <button
              onClick={() => navigate("/venues")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Running a venue or event? Learn about PULSE for venues →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
