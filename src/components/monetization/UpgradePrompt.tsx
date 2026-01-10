/**
 * Upgrade prompt component for feature gating
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, Lock } from "lucide-react";
import { SubscriptionTier, TIER_INFO } from "@/lib/monetization";
import { cn } from "@/lib/utils";

interface UpgradePromptProps {
  currentTier: SubscriptionTier;
  featureName: string;
  requiredTier?: SubscriptionTier;
  limit?: number | null;
  currentUsage?: number;
  variant?: 'inline' | 'card' | 'modal';
  onUpgrade?: () => void;
  className?: string;
}

export function UpgradePrompt({
  currentTier,
  featureName,
  requiredTier = 'plus',
  limit,
  currentUsage,
  variant = 'card',
  onUpgrade,
  className,
}: UpgradePromptProps) {
  const targetTier = TIER_INFO[requiredTier];

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Lock className="h-4 w-4" />
        <span>
          {featureName} requires {targetTier.name}
        </span>
        <Button variant="link" size="sm" className="h-auto p-0" onClick={onUpgrade}>
          Upgrade <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={cn("border-primary/20 bg-gradient-to-br from-primary/5 to-transparent", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Upgrade to Unlock</CardTitle>
        </div>
        <CardDescription>
          {limit !== null && currentUsage !== undefined ? (
            <>You've reached your limit of {limit} {featureName.toLowerCase()}.</>
          ) : (
            <>{featureName} is available on {targetTier.name} and above.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{targetTier.name}</span>
              {targetTier.popular && (
                <Badge variant="secondary" className="text-xs">Popular</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{targetTier.description}</p>
          </div>
          <div className="text-right">
            {targetTier.priceMonthly > 0 ? (
              <>
                <div className="font-bold text-lg">${targetTier.priceMonthly}</div>
                <div className="text-xs text-muted-foreground">/month</div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Contact us</div>
            )}
          </div>
        </div>

        <Button className="w-full" onClick={onUpgrade}>
          <Sparkles className="h-4 w-4 mr-2" />
          Upgrade to {targetTier.name}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Feature gate wrapper component
 */
interface FeatureGateProps {
  isEnabled: boolean;
  isLoading?: boolean;
  currentTier: SubscriptionTier;
  featureName: string;
  requiredTier?: SubscriptionTier;
  onUpgrade?: () => void;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureGate({
  isEnabled,
  isLoading,
  currentTier,
  featureName,
  requiredTier = 'plus',
  onUpgrade,
  children,
  fallback,
}: FeatureGateProps) {
  if (isLoading) {
    return <div className="animate-pulse h-20 bg-muted rounded-lg" />;
  }

  if (!isEnabled) {
    return fallback || (
      <UpgradePrompt
        currentTier={currentTier}
        featureName={featureName}
        requiredTier={requiredTier}
        onUpgrade={onUpgrade}
      />
    );
  }

  return <>{children}</>;
}

/**
 * Limit indicator component
 */
interface LimitIndicatorProps {
  current: number;
  limit: number | null;
  label: string;
  showUpgrade?: boolean;
  currentTier?: SubscriptionTier;
  onUpgrade?: () => void;
}

export function LimitIndicator({
  current,
  limit,
  label,
  showUpgrade,
  currentTier = 'free',
  onUpgrade,
}: LimitIndicatorProps) {
  const isUnlimited = limit === null;
  const isAtLimit = !isUnlimited && current >= limit;
  const percentage = isUnlimited ? 0 : Math.min((current / limit) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          "font-medium",
          isAtLimit && "text-destructive"
        )}>
          {current} / {isUnlimited ? '∞' : limit}
        </span>
      </div>
      
      {!isUnlimited && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full transition-all",
              isAtLimit ? "bg-destructive" : percentage > 80 ? "bg-warning" : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {isAtLimit && showUpgrade && (
        <UpgradePrompt
          currentTier={currentTier}
          featureName={label}
          limit={limit}
          currentUsage={current}
          variant="inline"
          onUpgrade={onUpgrade}
        />
      )}
    </div>
  );
}
