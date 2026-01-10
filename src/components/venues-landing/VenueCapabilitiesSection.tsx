import { Globe, Trophy, Shuffle, Users, LayoutDashboard } from "lucide-react";

const capabilities = [
  {
    icon: Globe,
    headline: "Own your digital presence",
    title: "Branded Venue Page / Mini-Site",
    points: [
      "Public-facing venue page",
      "Custom branding",
      "Event listings",
      "Player engagement hub",
    ],
  },
  {
    icon: Trophy,
    headline: "Run events with confidence",
    title: "Event & Tournament Hosting",
    points: [
      "Create tournaments & round robins",
      "Manage registrations",
      "Track results",
      "Reduce operational overhead",
    ],
  },
  {
    icon: Shuffle,
    headline: "Perfect for real-world play",
    title: "Round Robins & Open Play Tools",
    points: [
      "Built for open play",
      "Flexible formats",
      "No clipboards or whiteboards",
    ],
  },
  {
    icon: Users,
    headline: "Fill courts and build loyalty",
    title: "Player Discovery & Community Growth",
    points: [
      "Reach active players",
      "Grow repeat participation",
      "Build local pickleball culture",
    ],
  },
  {
    icon: LayoutDashboard,
    headline: "Tools that grow with you",
    title: "Venue Management Tools",
    points: [
      "Admin dashboards",
      "Event controls",
      "Player insights",
      "Future-ready architecture",
    ],
  },
];

export const VenueCapabilitiesSection = () => {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Core Venue Capabilities
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful tools designed for modern pickleball operations.
          </p>
        </div>

        <div className="space-y-16 md:space-y-24 max-w-6xl mx-auto">
          {capabilities.map((capability, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
              } items-center gap-8 md:gap-12`}
            >
              {/* Icon Block */}
              <div className="flex-shrink-0 w-full md:w-2/5">
                <div className="aspect-square max-w-[280px] mx-auto rounded-2xl bg-gradient-to-br from-secondary/10 to-primary/10 border border-border/50 flex items-center justify-center group hover:shadow-lg transition-all">
                  <capability.icon className="w-24 h-24 text-primary/80 group-hover:scale-110 transition-transform" />
                </div>
              </div>

              {/* Text Block */}
              <div className="flex-1 text-center md:text-left">
                <p className="text-primary font-medium mb-2 uppercase tracking-wide text-sm">
                  {capability.headline}
                </p>
                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                  {capability.title}
                </h3>
                <ul className="space-y-3">
                  {capability.points.map((point, pointIndex) => (
                    <li
                      key={pointIndex}
                      className="flex items-center gap-3 text-muted-foreground justify-center md:justify-start"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <span>{point}</span>
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
