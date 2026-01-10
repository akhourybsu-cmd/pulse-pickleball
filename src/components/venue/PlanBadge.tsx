import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface PlanBadgeProps {
  tier: "free" | "pro" | "enterprise";
  className?: string;
}

const tierConfig = {
  free: {
    label: "Free Plan",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  pro: {
    label: "Pro Plan",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  enterprise: {
    label: "Enterprise",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
};

export function PlanBadge({ tier, className = "" }: PlanBadgeProps) {
  const config = tierConfig[tier];

  return (
    <Badge 
      variant="outline" 
      className={`font-medium gap-1.5 ${config.className} ${className}`}
    >
      {tier !== "free" && <Sparkles className="h-3 w-3" />}
      {config.label}
    </Badge>
  );
}
