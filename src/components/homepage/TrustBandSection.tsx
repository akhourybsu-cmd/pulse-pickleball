import { Activity, Building2, Calendar } from "lucide-react";

const metrics = [
  {
    icon: Activity,
    value: "10,000+",
    label: "Matches Recorded",
  },
  {
    icon: Building2,
    value: "150+",
    label: "Venues Onboarded",
  },
  {
    icon: Calendar,
    value: "500+",
    label: "Events Hosted",
  },
];

export const TrustBandSection = () => {
  return (
    <section className="py-12 md:py-16 border-y border-border/50">
      <div className="container mx-auto px-4">
        <p className="text-center text-lg md:text-xl font-medium text-muted-foreground mb-8">
          Built for{" "}
          <span className="text-foreground">real play</span>,{" "}
          <span className="text-foreground">real venues</span>,{" "}
          <span className="text-foreground">real competition</span>
        </p>

        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center min-w-[120px]"
            >
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
              <span className="text-2xl md:text-3xl font-bold font-display bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {metric.value}
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                {metric.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
