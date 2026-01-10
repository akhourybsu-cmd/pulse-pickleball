import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Coffee, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const useCases = [
  {
    id: "casual",
    icon: Coffee,
    title: "Casual Players",
    description: "Track games and find play opportunities without the pressure.",
    features: [
      "Easy match logging",
      "Find open play sessions",
      "Connect with local players",
      "No commitment required",
    ],
  },
  {
    id: "competitive",
    icon: Target,
    title: "Competitive Players",
    description: "Get accurate ratings and track your tournament journey.",
    features: [
      "Precise Pulse rating",
      "Tournament registration",
      "Performance analytics",
      "Opponent history",
    ],
  },
  {
    id: "league",
    icon: Trophy,
    title: "League Players",
    description: "Keep your history, stats, and consistency all in one place.",
    features: [
      "Full match history",
      "Season statistics",
      "Team coordination",
      "League standings",
    ],
  },
];

export const UseCasesSection = () => {
  const [activeCase, setActiveCase] = useState("casual");

  const activeData = useCases.find((uc) => uc.id === activeCase);

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-4">
            Pulse Works for Everyone
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you play for fun or competition, Pulse adapts to your style.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {useCases.map((useCase) => (
            <button
              key={useCase.id}
              onClick={() => setActiveCase(useCase.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeCase === useCase.id
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <useCase.icon className="h-4 w-4" />
              {useCase.title}
            </button>
          ))}
        </div>

        {/* Content Card */}
        {activeData && (
          <Card className="max-w-2xl mx-auto bg-card/80 backdrop-blur border-border/50">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <activeData.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{activeData.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {activeData.description}
                  </p>
                </div>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeData.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
};
