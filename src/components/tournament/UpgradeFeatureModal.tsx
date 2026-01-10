import { Crown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFeatureById, TOURNAMENT_FEATURES, type TournamentFeature } from "@/lib/tournamentFeatures";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

interface UpgradeFeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureId: string;
  currentTier: SubscriptionTier;
  onUpgrade?: () => void;
}

const TIER_PRICING: Record<SubscriptionTier, { name: string; price: string; features: string[] }> = {
  free: {
    name: "Free",
    price: "$0/mo",
    features: ["Create & publish tournaments", "External registration links", "Basic event management"],
  },
  plus: {
    name: "Plus",
    price: "$29/mo",
    features: ["In-app registration", "Bracket automation", "Multi-day scheduling", "Email notifications"],
  },
  pro: {
    name: "Pro",
    price: "$79/mo",
    features: ["Check-in kiosk mode", "Automated messaging", "Tournament analytics", "Custom branding"],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    features: ["Dedicated support", "Custom integrations", "Unlimited events", "Priority features"],
  },
};

export function UpgradeFeatureModal({
  open,
  onOpenChange,
  featureId,
  currentTier,
  onUpgrade,
}: UpgradeFeatureModalProps) {
  const feature = getFeatureById(featureId);
  const requiredTier = feature?.requiredTier || "plus";
  const tierInfo = TIER_PRICING[requiredTier];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Crown className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Upgrade to Unlock</DialogTitle>
          <DialogDescription className="text-center">
            {feature?.name} requires {tierInfo.name} plan or higher
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Feature description */}
          {feature && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-1">{feature.name}</h4>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          )}

          {/* Plan comparison */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">{tierInfo.name}</h4>
                <p className="text-2xl font-bold text-primary">{tierInfo.price}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {tierInfo.features.map((feat) => (
                <li key={feat} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Maybe Later
          </Button>
          <Button
            onClick={() => {
              onUpgrade?.();
              onOpenChange(false);
            }}
            className="w-full sm:w-auto gap-2"
          >
            <Crown className="h-4 w-4" />
            Upgrade to {tierInfo.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
