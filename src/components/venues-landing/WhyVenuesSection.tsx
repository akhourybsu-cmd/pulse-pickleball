import { Card, CardContent } from "@/components/ui/card";
import { Palette, CalendarDays, TrendingUp, Settings } from "lucide-react";

const valueProps = [
  {
    icon: Palette,
    title: "Your Brand, Not Ours",
    description: "Custom venue pages. Your logo, colors, and identity.",
  },
  {
    icon: CalendarDays,
    title: "All Events, One System",
    description: "Round robins, leagues, tournaments. One workflow, one platform.",
  },
  {
    icon: TrendingUp,
    title: "Built for Growth",
    description: "Player discovery. Community engagement. Event visibility.",
  },
  {
    icon: Settings,
    title: "Designed for Real Operations",
    description: "No spreadsheets. No manual coordination. No duct-taped tools.",
  },
];

export const WhyVenuesSection = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Why Venues Choose Pulse
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to run a professional pickleball operation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {valueProps.map((prop, index) => (
            <Card
              key={index}
              variant="interactive"
              className="group cursor-default"
            >
              <CardContent className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <prop.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">
                      {prop.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {prop.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
