import {
  Activity,
  Swords,
  RotateCcw,
  Trophy,
  Users,
  CalendarDays,
} from "lucide-react";

/**
 * "Everything PULSE does" — the full player-facing toolkit.
 *
 * Now includes Leagues (fully player-facing: create, run, and play in
 * leagues — first one's free). Round Robins + Leagues carry a featured
 * ring since they're the flagship organizer surfaces. Copy is written in
 * an in-the-know pickleball voice rather than generic SaaS.
 */
const features = [
  {
    icon: Activity,
    title: "PULSE Rating",
    tag: "Skill, quantified",
    description:
      "A dynamic rating that recalibrates after every verified match. Watch it climb from your first dink to your first tournament.",
    featured: false,
  },
  {
    icon: Swords,
    title: "Match Recording",
    tag: "Under 30 seconds",
    description:
      "Log singles or doubles courtside. Partners confirm the score, ratings update, and it's saved to your history instantly.",
    featured: false,
  },
  {
    icon: RotateCcw,
    title: "Round Robins",
    tag: "Auto-scheduled",
    description:
      "Spin up balanced rotations in a tap — fair pairings, guest players, a live scoring kiosk, and standings that update in real time.",
    featured: true,
  },
  {
    icon: Trophy,
    title: "Leagues",
    tag: "First one's free",
    description:
      "Run singles, doubles, team, flex, or ladder leagues with seasons, divisions, standings, and shareable invite codes.",
    featured: true,
  },
  {
    icon: Users,
    title: "Community",
    tag: "Your crew",
    description:
      "Join groups, post looking-for-game, share highlights, and message friends directly. Your whole pickleball circle in one feed.",
    featured: false,
  },
  {
    icon: CalendarDays,
    title: "Open Play & Events",
    tag: "Near you",
    description:
      "Find open play, clinics, and round robins happening nearby, then register in a tap and add them to your calendar.",
    featured: false,
  },
];

export const PlayerFeaturesSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
            Everything your game needs
          </h2>
          <p className="text-lg text-muted-foreground">
            One app that spans the whole sport — from your rating to your rivalries.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group relative rounded-2xl border bg-card p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                feature.featured
                  ? "border-primary/40 ring-1 ring-primary/15"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              {feature.featured && (
                <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Flagship
                </span>
              )}
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">
                {feature.tag}
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
