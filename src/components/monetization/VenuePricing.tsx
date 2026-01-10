/**
 * Pricing page component for venue subscriptions
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SubscriptionTier, TIER_INFO } from "@/lib/monetization";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  tier: SubscriptionTier;
  venueId: string;
  currentTier: SubscriptionTier;
  isYearly: boolean;
  isLoading: boolean;
  onSelect: (tier: SubscriptionTier) => void;
}

function PricingCard({ 
  tier, 
  venueId, 
  currentTier, 
  isYearly, 
  isLoading,
  onSelect 
}: PricingCardProps) {
  const info = TIER_INFO[tier];
  const isCurrent = tier === currentTier;
  const isUpgrade = !isCurrent && tier !== 'free' && tier !== 'enterprise';
  const price = isYearly ? info.priceYearly : info.priceMonthly;
  const period = isYearly ? '/year' : '/month';

  const features: Record<SubscriptionTier, string[]> = {
    free: [
      "2 events per month",
      "Up to 2 courts",
      "1 coach profile",
      "Basic analytics",
      "Community support",
    ],
    plus: [
      "10 events per month",
      "Up to 8 courts",
      "5 coach profiles",
      "Advanced analytics",
      "Email support",
    ],
    pro: [
      "Unlimited events",
      "Unlimited courts",
      "Unlimited coaches",
      "Custom branding",
      "Priority support",
      "API access",
    ],
    enterprise: [
      "Everything in Pro",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Volume discounts",
    ],
  };

  return (
    <Card className={cn(
      "relative flex flex-col",
      isCurrent && "ring-2 ring-primary",
      info.popular && !isCurrent && "ring-1 ring-primary/50"
    )}>
      {info.popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
          Most Popular
        </Badge>
      )}
      {isCurrent && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="secondary">
          Current Plan
        </Badge>
      )}

      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">{info.name}</CardTitle>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div className="text-center">
          {tier === 'enterprise' ? (
            <div className="text-2xl font-bold">Custom</div>
          ) : (
            <>
              <span className="text-4xl font-bold">${price}</span>
              <span className="text-muted-foreground">{period}</span>
            </>
          )}
          {isYearly && tier !== 'free' && tier !== 'enterprise' && (
            <p className="text-sm text-green-600 mt-1">Save 2 months free</p>
          )}
        </div>

        <ul className="space-y-2">
          {features[tier].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-primary shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        {tier === 'free' ? (
          <Button variant="outline" className="w-full" disabled>
            {isCurrent ? "Current Plan" : "Free Forever"}
          </Button>
        ) : tier === 'enterprise' ? (
          <Button variant="outline" className="w-full" asChild>
            <a href="mailto:enterprise@pulse.app">Contact Sales</a>
          </Button>
        ) : isCurrent ? (
          <Button variant="outline" className="w-full" disabled>
            Current Plan
          </Button>
        ) : (
          <Button 
            className="w-full" 
            onClick={() => onSelect(tier)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            {isUpgrade ? "Upgrade" : "Select"} {info.name}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

interface VenuePricingProps {
  venueId: string;
  currentTier: SubscriptionTier;
  onSubscriptionChange?: () => void;
}

export function VenuePricing({ venueId, currentTier, onSubscriptionChange }: VenuePricingProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);

  const handleSelectTier = async (tier: SubscriptionTier) => {
    setIsLoading(true);
    setSelectedTier(tier);

    try {
      const { data, error } = await supabase.functions.invoke('subscription-checkout', {
        body: { venueId, tier },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Failed to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
      setSelectedTier(null);
    }
  };

  const tiers: SubscriptionTier[] = ['free', 'plus', 'pro', 'enterprise'];

  return (
    <div className="space-y-8">
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={cn(!isYearly && "font-semibold")}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={isYearly}
          onCheckedChange={setIsYearly}
        />
        <Label htmlFor="billing-toggle" className={cn(isYearly && "font-semibold")}>
          Yearly
          <Badge variant="secondary" className="ml-2">Save 17%</Badge>
        </Label>
      </div>

      {/* Pricing cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => (
          <PricingCard
            key={tier}
            tier={tier}
            venueId={venueId}
            currentTier={currentTier}
            isYearly={isYearly}
            isLoading={isLoading && selectedTier === tier}
            onSelect={handleSelectTier}
          />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        All plans include a 14-day free trial. Cancel anytime.
      </p>
    </div>
  );
}
