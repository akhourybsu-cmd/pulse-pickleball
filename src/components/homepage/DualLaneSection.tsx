import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  Smartphone,
  History,
  Users,
  Calendar,
  Trophy,
  Building2,
  Palette,
  CalendarDays,
  RotateCcw,
  Search,
  Settings,
} from "lucide-react";

const playerFeatures = [
  { icon: TrendingUp, label: "Pulse rating & performance tracking" },
  { icon: Smartphone, label: "One-tap match recording" },
  { icon: History, label: "Match history & stats" },
  { icon: Users, label: "Community groups" },
  { icon: RotateCcw, label: "Join round robins" },
  { icon: Trophy, label: "Discover & register for tournaments" },
];

const venueFeatures = [
  { icon: Building2, label: "Branded venue page / mini-site" },
  { icon: Palette, label: "Custom player experience" },
  { icon: CalendarDays, label: "Event & tournament hosting" },
  { icon: RotateCcw, label: "Round robin tools for open play" },
  { icon: Search, label: "Player discovery & community growth" },
  { icon: Settings, label: "Admin & operations tools (scalable)" },
];

export const DualLaneSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Player Lane */}
          <Card className="border-2 hover:border-primary/50 transition-colors duration-300 hover:shadow-lg">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display">
                For Players
              </CardTitle>
              <p className="text-muted-foreground">
                Empowering your competitive journey
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {playerFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm md:text-base">{feature.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full mt-6 bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                Create Player Profile
              </Button>
            </CardContent>
          </Card>

          {/* Venue Lane */}
          <Card className="border-2 hover:border-secondary/50 transition-colors duration-300 hover:shadow-lg">
            <CardHeader className="pb-4">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6 text-secondary" />
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display">
                For Venues & Organizers
              </CardTitle>
              <p className="text-muted-foreground">
                Professional tools for growth
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {venueFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-4 w-4 text-secondary" />
                    </div>
                    <span className="text-sm md:text-base">{feature.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => navigate("/venues")}
                className="w-full mt-6 bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground hover:shadow-lg hover:shadow-secondary/20 transition-all"
              >
                Claim Your Venue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
