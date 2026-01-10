import { 
  TrendingUp, 
  Zap, 
  BarChart3, 
  Shuffle, 
  Trophy, 
  Users2 
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    headline: "Know your game",
    title: "Pulse Rating & Match Tracking",
    points: [
      "Pulse rating updates automatically",
      "Track wins, losses, opponents, and formats",
      "See your growth over time",
    ],
  },
  {
    icon: Zap,
    headline: "Record matches in seconds",
    title: "One-Tap Match Recording",
    points: [
      "Designed for real courts",
      "Minimal inputs",
      "No friction after play",
    ],
  },
  {
    icon: BarChart3,
    headline: "See how you're improving",
    title: "Match History & Insights",
    points: [
      "Full match log",
      "Performance trends",
      "Competitive context",
    ],
  },
  {
    icon: Shuffle,
    headline: "Play more, stress less",
    title: "Round Robins & Open Play",
    points: [
      "Join or create round robins",
      "Perfect for open play and group nights",
      "No manual coordination",
    ],
  },
  {
    icon: Trophy,
    headline: "Compete with confidence",
    title: "Tournaments",
    points: [
      "Browse upcoming tournaments",
      "Register easily",
      "Track results inside your profile",
    ],
  },
  {
    icon: Users2,
    headline: "Connect off the court",
    title: "Community Groups",
    points: [
      "Join groups by venue, skill, or interest",
      "Stay in the loop",
      "Build rivalries and friendships",
    ],
  },
];

export const CoreFeaturesSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4">
            Core Player Features
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need to elevate your pickleball experience.
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-16 md:space-y-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              } items-center gap-8 md:gap-12`}
            >
              {/* Icon Block */}
              <div className="flex-shrink-0 w-full md:w-2/5">
                <div className="aspect-square max-w-[280px] mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                  <feature.icon className="h-20 w-20 md:h-24 md:w-24 text-primary" />
                </div>
              </div>

              {/* Text Block */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-primary font-medium text-sm uppercase tracking-wide mb-2">
                  {feature.title}
                </p>
                <h3 className="text-2xl sm:text-3xl font-display font-bold mb-4">
                  {feature.headline}
                </h3>
                <ul className="space-y-3">
                  {feature.points.map((point, pointIndex) => (
                    <li
                      key={pointIndex}
                      className="flex items-center gap-3 text-muted-foreground justify-center md:justify-start"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
