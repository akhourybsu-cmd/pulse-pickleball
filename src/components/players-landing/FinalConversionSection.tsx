import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

const reassurances = [
  "Free to start",
  "No credit card",
  "Takes under 1 minute",
];

export const FinalConversionSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold mb-6">
            Your game deserves better tracking.
          </h2>

          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="w-full sm:w-auto text-lg px-10 py-7 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            Create Free Player Account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
            {reassurances.map((text, index) => (
              <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-primary" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
