import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Plus, RotateCcw } from "lucide-react";

/**
 * Quick action preview tiles on the public landing.
 *
 * Player-only set. The previous "Find Places to Play" tile (which linked to
 * /player/venues) has been removed as part of the player-first refocus —
 * venue discovery lives behind the mode toggle, not on the homepage.
 */
const tiles = [
  {
    icon: TrendingUp,
    title: "Track Your PULSE",
    description: "Monitor your rating and growth",
    href: "/auth",
  },
  {
    icon: Plus,
    title: "Record a Match",
    description: "Log singles or doubles in seconds",
    href: "/auth",
  },
  {
    icon: RotateCcw,
    title: "Run a Round Robin",
    description: "Organize open play sessions",
    href: "/round-robin",
  },
];

export const QuickActionTiles = () => {
  const navigate = useNavigate();

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold font-display text-center mb-10">
          Quick Actions
        </h2>

        {/* Desktop / tablet grid */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
          {tiles.map((tile, index) => (
            <Card
              key={index}
              onClick={() => navigate(tile.href)}
              className="cursor-pointer group border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <tile.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">{tile.title}</h3>
                <p className="text-sm text-muted-foreground">{tile.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile horizontal scroll */}
        <div className="sm:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 w-max pb-4">
            {tiles.map((tile, index) => (
              <Card
                key={index}
                onClick={() => navigate(tile.href)}
                className="cursor-pointer group border-2 min-w-[200px] active:scale-95 transition-transform"
              >
                <CardContent className="p-5 text-center">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <tile.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{tile.title}</h3>
                  <p className="text-xs text-muted-foreground">{tile.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
