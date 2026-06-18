import {
  TrendingUp,
  Swords,
  RotateCcw,
  Users,
  Calendar,
  Trophy,
} from "lucide-react";

/**
 * Player Features grid — replaces the old TrustBandSection that displayed
 * fabricated metrics ("10,000+ matches recorded"). This section spotlights
 * the actual player-facing features the platform ships today.
 */
const features = [
  {
    icon: TrendingUp,
    title: "PULSE Rating",
    description:
      "A dynamic skill rating that updates after every recorded match — see how you're trending week over week.",
  },
  {
    icon: Swords,
    title: "Match Recording",
    description:
      "Log singles or doubles in under 30 seconds. Partners verify, ratings update, history is saved.",
  },
  {
    icon: RotateCcw,
    title: "Round Robins",
    description:
      "Spin up a balanced round robin in a tap. Auto-generated brackets, live standings, fair pairings.",
  },
  {
    icon: Users,
    title: "Community Hub",
    description:
      "Join groups, post LFG, share highlights, message friends — your pickleball crew in one place.",
  },
  {
    icon: Calendar,
    title: "Find Events",
    description:
      "Browse open play, clinics, tournaments and round robins happening near you. Register in a tap.",
  },
  {
    icon: Trophy,
    title: "Tournaments",
    description:
      "Enter tournaments, track your bracket live, and add the trophies to your player profile.",
  },
];

export const PlayerFeaturesSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold font-display mb-4">
            Everything a player needs
          </h2>
          <p className="text-muted-foreground">
            Six tools, one app — built around how you actually play.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-2xl border border-border/60 bg-card p-6 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
