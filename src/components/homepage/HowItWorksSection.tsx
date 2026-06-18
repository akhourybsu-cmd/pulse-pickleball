import { UserPlus, Gamepad2, TrendingUp } from "lucide-react";

/**
 * "How It Works" — Players only.
 *
 * The previous version had a Players/Venues tab switcher. Venue tab pulled
 * during the player-focused beta — the homepage no longer surfaces any
 * venue/organizer story.
 */
const playerSteps = [
  {
    icon: UserPlus,
    title: "Create Profile",
    description: "Sign up and set your initial skill level",
  },
  {
    icon: Gamepad2,
    title: "Play & Record",
    description: "Log matches with a single tap after you play",
  },
  {
    icon: TrendingUp,
    title: "Level Up",
    description: "Watch your PULSE rating evolve with every game",
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="py-16 md:py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold font-display text-center mb-4">
          How It Works
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-md mx-auto">
          Get started in three simple steps
        </p>

        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Line (desktop only) */}
            <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {playerSteps.map((step, index) => (
              <div
                key={index}
                className="relative flex flex-col items-center text-center animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Step Number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center text-xs font-bold text-primary z-10">
                  {index + 1}
                </div>

                {/* Icon Circle */}
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:scale-105 bg-primary/10">
                  <step.icon className="h-9 w-9 text-primary" />
                </div>

                {/* Text */}
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground max-w-[200px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
