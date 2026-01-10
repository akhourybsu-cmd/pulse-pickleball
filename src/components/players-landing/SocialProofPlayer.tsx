import { Activity, Users, CalendarDays } from "lucide-react";

const metrics = [
  {
    icon: Activity,
    value: "10,000+",
    label: "Matches Recorded",
  },
  {
    icon: Users,
    value: "5,000+",
    label: "Active Players",
  },
  {
    icon: CalendarDays,
    value: "500+",
    label: "Events Hosted",
  },
];

export const SocialProofPlayer = () => {
  return (
    <section className="py-16 md:py-20 bg-secondary/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-lg md:text-xl font-medium text-foreground">
            Built by pickleball players, for pickleball players
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <metric.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  {metric.value}
                </p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
