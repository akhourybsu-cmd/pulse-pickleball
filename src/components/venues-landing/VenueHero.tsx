import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Building, Play } from "lucide-react";

export const VenueHero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background with structured gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/5" />
      
      {/* Animated geometric shapes - more structured/professional */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-primary/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-primary/3 rounded-full" />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium">
            <Building className="w-4 h-4" />
            For Venues & Organizers
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight text-foreground">
            Run your pickleball venue like a{" "}
            <span className="text-primary">modern platform</span>.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Create a branded venue experience, manage events and tournaments, and grow your pickleball community — all under your name.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all"
              onClick={() => navigate("/venue/interest")}
            >
              <Building className="w-5 h-5 mr-2" />
              Claim Your Venue
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto text-lg px-8 py-6 border-2"
              onClick={() => navigate("/v/pickleball-palace")}
            >
              <Play className="w-5 h-5 mr-2" />
              Explore Demo Venue
            </Button>
          </div>

          {/* Reassurance text */}
          <p className="text-sm text-muted-foreground pt-2">
            No setup fees • Scales with your facility
          </p>
        </div>
      </div>
    </section>
  );
};
