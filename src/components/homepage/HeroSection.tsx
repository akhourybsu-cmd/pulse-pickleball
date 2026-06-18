import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn } from "lucide-react";

/**
 * Hero — Player-only.
 *
 * Primary CTA gets people to sign up; secondary "Sign In" makes returning
 * to the dashboard a one-tap action for existing users. Venue/organizer
 * affordances are gone for the player-focused beta.
 */
export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      {/* Soft animated background — single hue, no dual-color gradient. */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="container mx-auto px-4 text-center">
        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6 max-w-3xl mx-auto">
          Your pickleball journey,{" "}
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            tracked and rated
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Record matches in seconds, watch your PULSE rating evolve, and play round robins with your crew. Built for everyday players.
        </p>

        {/* Primary + secondary CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="group h-14 px-10 text-lg font-semibold bg-gradient-to-r from-primary to-primary/85 hover:shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all duration-300 w-full sm:w-auto"
          >
            Get Started — Free
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => navigate("/auth")}
            className="h-14 px-8 text-lg font-semibold w-full sm:w-auto"
          >
            <LogIn className="mr-2 h-5 w-5" />
            Sign In
          </Button>
        </div>
      </div>
    </section>
  );
};
