import { Building, Palette, Calendar, Users } from "lucide-react";

const steps = [
  {
    icon: Building,
    title: "Claim your venue",
    description: "Register and verify your facility",
  },
  {
    icon: Palette,
    title: "Customize branding & settings",
    description: "Make it yours with your logo and colors",
  },
  {
    icon: Calendar,
    title: "Create events & play formats",
    description: "Set up tournaments, round robins, and open play",
  },
  {
    icon: Users,
    title: "Grow your community",
    description: "Attract players and build loyalty",
  },
];

export const HowItWorksVenue = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get your venue running on Pulse in four simple steps.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Desktop: Horizontal stepper */}
          <div className="hidden md:flex items-start justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-8 left-[10%] right-[10%] h-0.5 bg-border" />
            <div className="absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" style={{ width: '75%' }} />

            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center relative z-10 flex-1">
                <div className="w-16 h-16 rounded-full bg-background border-2 border-primary flex items-center justify-center mb-4 shadow-lg">
                  <step.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground max-w-[180px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>

          {/* Mobile: Vertical stepper */}
          <div className="md:hidden space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-lg">
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="absolute top-14 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-border" />
                  )}
                </div>
                <div className="pt-2">
                  <h3 className="text-lg font-semibold text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
