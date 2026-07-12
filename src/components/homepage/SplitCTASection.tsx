import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { CourtMotif } from "./CourtMotif";

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
    <section className="relative overflow-hidden py-20 md:py-28">
      {/* Ink band so the closing CTA lands with weight against the cream page. */}
      <div className="absolute inset-0 -z-10 bg-secondary" />
      <CourtMotif className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] max-w-none text-secondary-foreground/[0.06]" />

      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center text-secondary-foreground">
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Grab your paddle. We've got the rest.
          </h2>
          <p className="text-lg text-secondary-foreground/70 mb-8">
            Track your rating, run round robins and leagues, and rally your
            crew — free to start, no credit card.
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="group h-14 px-10 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300"
          >
            Create your free account
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
};
