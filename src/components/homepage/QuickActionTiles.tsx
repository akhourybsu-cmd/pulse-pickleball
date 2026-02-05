import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, MapPin, RotateCcw } from "lucide-react";

const tiles = [
  {
    icon: TrendingUp,
    title: "Track Your Pulse",
    description: "Monitor your rating and growth",
    href: "/auth",
    color: "primary" as const,
  },
  {
    icon: MapPin,
    title: "Find Places to Play",
    description: "Discover courts near you",
    href: "/player/venues",
    color: "secondary" as const,
  },
  {
    icon: RotateCcw,
    title: "Run a Round Robin",
    description: "Organize open play sessions",
    href: "/round-robin",
    color: "primary" as const,
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

        {/* Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto">
          {tiles.map((tile, index) => (
            <Card
              key={index}
              onClick={() => navigate(tile.href)}
              className={`cursor-pointer group border-2 hover:border-${tile.color}/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1`}
            >
              <CardContent className="p-6 text-center">
                <div
                  className={`w-14 h-14 rounded-xl bg-${tile.color}/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <tile.icon className={`h-7 w-7 text-${tile.color}`} />
                </div>
                <h3 className="font-semibold text-lg mb-1">{tile.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {tile.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile Horizontal Scroll */}
        <div className="sm:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-4 w-max pb-4">
            {tiles.map((tile, index) => (
              <Card
                key={index}
                onClick={() => navigate(tile.href)}
                className="cursor-pointer group border-2 min-w-[200px] active:scale-95 transition-transform"
              >
                <CardContent className="p-5 text-center">
                  <div
                    className={`w-12 h-12 rounded-xl bg-${tile.color}/10 flex items-center justify-center mx-auto mb-3`}
                  >
                    <tile.icon className={`h-6 w-6 text-${tile.color}`} />
                  </div>
                  <h3 className="font-semibold mb-1">{tile.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {tile.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
