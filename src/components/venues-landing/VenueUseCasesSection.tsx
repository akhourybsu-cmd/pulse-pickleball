import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Crown, Landmark, Trophy } from "lucide-react";

const useCases = [
  {
    id: "recreation",
    icon: Building2,
    title: "Recreation Centers / YMCAs",
    description: "Community play, open events, accessibility",
    features: [
      "Public scheduling and drop-in events",
      "Member engagement tools",
      "Community program management",
      "Accessible to all skill levels",
    ],
  },
  {
    id: "private",
    icon: Crown,
    title: "Private Clubs",
    description: "Member engagement, premium events",
    features: [
      "Exclusive member-only events",
      "Premium branded experience",
      "VIP tournament hosting",
      "Advanced player analytics",
    ],
  },
  {
    id: "municipal",
    icon: Landmark,
    title: "Municipal Courts",
    description: "Organized play, public visibility",
    features: [
      "Public event listings",
      "Community program scheduling",
      "Usage analytics and reporting",
      "Multi-location management",
    ],
  },
  {
    id: "tournament",
    icon: Trophy,
    title: "Tournament Directors",
    description: "Centralized operations, scalable events",
    features: [
      "Multi-event management",
      "Registration handling",
      "Results tracking and brackets",
      "Scalable infrastructure",
    ],
  },
];

export const VenueUseCasesSection = () => {
  const [activeCase, setActiveCase] = useState("recreation");
  const activeUseCase = useCases.find((uc) => uc.id === activeCase) || useCases[0];

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
            Built for Every Venue Type
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you're a rec center or tournament director, Pulse adapts to your needs.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Tab buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {useCases.map((useCase) => (
              <button
                key={useCase.id}
                onClick={() => setActiveCase(useCase.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-medium transition-all ${
                  activeCase === useCase.id
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <useCase.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{useCase.title.split(" / ")[0]}</span>
                <span className="sm:hidden">{useCase.title.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Active use case card */}
          <Card variant="interactive" className="overflow-hidden">
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <activeUseCase.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {activeUseCase.title}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {activeUseCase.description}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeUseCase.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
