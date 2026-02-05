import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { User, Building2 } from "lucide-react";

export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      {/* Animated Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-secondary/10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 text-center">
        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-tight mb-6 max-w-4xl mx-auto">
          The all-in-one pickleball platform for{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            players and venues
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Track your Pulse rating, record matches, find places to play, and run round robins and tournaments — all in one system.
        </p>

        {/* Dual CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="group relative h-14 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all duration-300"
          >
            <User className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
            I'm a Player
          </Button>
          <Button
            size="lg"
            onClick={() => navigate("/venues")}
            className="group relative h-14 px-8 text-lg font-semibold bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-xl hover:shadow-secondary/25 hover:scale-105 transition-all duration-300"
          >
            <Building2 className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
            I'm a Venue / Organizer
          </Button>
        </div>

        {/* Secondary Links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm">
          <button
            onClick={() => navigate("/player/venues")}
            className="text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Browse Venues
          </button>
          <span className="text-muted-foreground/50">|</span>
          <button
            onClick={() => navigate("/round-robin")}
            className="text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
          >
            Create a Round Robin
          </button>
        </div>
      </div>
    </section>
  );
};
