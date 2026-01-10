import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, TrendingUp, Users, Layers } from "lucide-react";

const valueProps = [
  {
    icon: Smartphone,
    title: "Play Smarter",
    description: "Record matches instantly. No spreadsheets, no confusion.",
  },
  {
    icon: TrendingUp,
    title: "Real Ratings",
    description: "Pulse score reflects actual play. Built for pickleball, not adapted from tennis.",
  },
  {
    icon: Users,
    title: "Find Your People",
    description: "Join groups. Discover players, venues, and events.",
  },
  {
    icon: Layers,
    title: "One Platform",
    description: "Matches, history, events, and community — together.",
  },
];

export const WhyPulseSection = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4">
            Why Pulse for Players
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to track, improve, and enjoy your game.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {valueProps.map((prop, index) => (
            <Card
              key={index}
              className="group bg-card/80 backdrop-blur border-border/50 hover:border-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                  <prop.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{prop.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {prop.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
