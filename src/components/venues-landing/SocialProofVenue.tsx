import { Building, Calendar, Users } from "lucide-react";
import CountUp from "react-countup";

const metrics = [
  {
    icon: Building,
    value: 100,
    suffix: "+",
    label: "Venues Onboarded",
  },
  {
    icon: Calendar,
    value: 1000,
    suffix: "+",
    label: "Events Hosted",
  },
  {
    icon: Users,
    value: 25000,
    suffix: "+",
    label: "Players Engaged",
  },
];

export const SocialProofVenue = () => {
  return (
    <section className="py-16 md:py-20 bg-gradient-to-r from-secondary/5 via-primary/5 to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <p className="text-lg md:text-xl font-medium text-foreground">
            Built for real venues, not generic scheduling tools
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {metrics.map((metric, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <metric.icon className="w-6 h-6 text-primary" />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                <CountUp
                  end={metric.value}
                  duration={2.5}
                  separator=","
                  suffix={metric.suffix}
                  enableScrollSpy
                  scrollSpyOnce
                />
              </div>
              <p className="text-sm text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
