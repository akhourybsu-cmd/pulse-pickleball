import { UserPlus, Gamepad2, TrendingUp, Calendar } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Create your player profile",
    description: "Sign up in under a minute",
  },
  {
    icon: Gamepad2,
    title: "Play & record matches",
    description: "Log games with one tap",
  },
  {
    icon: TrendingUp,
    title: "Build your Pulse rating",
    description: "Watch your rating grow",
  },
  {
    icon: Calendar,
    title: "Join games, events, and tournaments",
    description: "Find your next match",
  },
];

export const HowItWorksPlayer = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get started in four simple steps.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Desktop: Horizontal flow */}
          <div className="hidden md:flex items-start justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-10 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />
            
            {steps.map((step, index) => (
              <div key={index} className="flex flex-col items-center text-center w-1/4 relative z-10">
                <div className="w-20 h-20 rounded-full bg-background border-2 border-primary flex items-center justify-center mb-4 shadow-lg">
                  <step.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                  {index + 1}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>

          {/* Mobile: Vertical flow */}
          <div className="md:hidden space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-lg">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="absolute top-14 left-1/2 w-0.5 h-8 bg-primary/30 -translate-x-1/2" />
                  )}
                </div>
                <div className="pt-2">
                  <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
