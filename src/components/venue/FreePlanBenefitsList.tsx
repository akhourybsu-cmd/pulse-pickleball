import { Check, Building2, Trophy, Users, Eye, Settings, DollarSign } from "lucide-react";

interface FreePlanBenefitsListProps {
  variant?: "default" | "compact";
  showMicrocopy?: boolean;
}

const benefits = [
  { icon: Building2, text: "Public venue profile on Pulse" },
  { icon: Trophy, text: "Publish and host tournaments" },
  { icon: DollarSign, text: "Tournaments priced at standard rates (no Pulse markup)" },
  { icon: Users, text: "Free Round Robins & open play events" },
  { icon: Eye, text: "Venue visibility in Pulse discovery" },
  { icon: Settings, text: "Manage your venue and events" },
];

export function FreePlanBenefitsList({ variant = "default", showMicrocopy = false }: FreePlanBenefitsListProps) {
  const isCompact = variant === "compact";

  return (
    <div className="space-y-3">
      {benefits.map((benefit, index) => {
        const Icon = benefit.icon;
        return (
          <div 
            key={index} 
            className={`flex items-center gap-3 ${isCompact ? "text-sm" : ""}`}
          >
            <div className={`flex-shrink-0 rounded-full bg-primary/10 flex items-center justify-center ${isCompact ? "h-6 w-6" : "h-8 w-8"}`}>
              <Check className={`text-primary ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
            </div>
            <span className={isCompact ? "text-muted-foreground" : "font-medium"}>
              {benefit.text}
            </span>
          </div>
        );
      })}
      
      {showMicrocopy && (
        <p className="text-sm text-muted-foreground pt-2 border-t border-border/50 mt-4">
          Tournaments are priced the same as usual. Pulse does not add additional fees.
        </p>
      )}
    </div>
  );
}
