/**
 * Subscription management component for venues
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Settings, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription, FEATURE_KEYS } from "@/hooks/useSubscription";
import { TIER_INFO } from "@/lib/monetization";
import { LimitIndicator } from "./UpgradePrompt";
import { format } from "date-fns";

interface SubscriptionManagementProps {
  venueId: string;
  onUpgrade?: () => void;
}

export function SubscriptionManagement({ venueId, onUpgrade }: SubscriptionManagementProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { 
    subscription, 
    tier, 
    isLoading: subLoading,
    isPaid,
    getFeatureLimit,
  } = useSubscription({ venueId });

  const tierInfo = TIER_INFO[tier];

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('venue-customer-portal', {
        body: { venueId },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error("Failed to open subscription portal. Please try again.");
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('check-venue-subscription', {
        body: { venueId },
      });

      if (error) throw error;
      toast.success("Subscription status refreshed");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh subscription status");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (subLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>Manage your venue subscription</CardDescription>
          </div>
          <Badge variant={isPaid ? "default" : "secondary"}>
            {tierInfo.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current plan details */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <span className="font-semibold">{tierInfo.name}</span>
          </div>

          {isPaid && subscription?.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Renews On</span>
              <span>{format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
            </div>
          )}

          {subscription?.cancel_at_period_end && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Subscription will cancel at period end</span>
            </div>
          )}
        </div>

        {/* Usage limits */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Usage</h4>
          
          <LimitIndicator
            current={0} // TODO: Fetch actual count
            limit={getFeatureLimit(FEATURE_KEYS.MAX_EVENTS_PER_MONTH)}
            label="Events this month"
            showUpgrade={!isPaid}
            currentTier={tier}
            onUpgrade={onUpgrade}
          />

          <LimitIndicator
            current={0} // TODO: Fetch actual count
            limit={getFeatureLimit(FEATURE_KEYS.MAX_COURTS)}
            label="Courts"
            showUpgrade={!isPaid}
            currentTier={tier}
            onUpgrade={onUpgrade}
          />

          <LimitIndicator
            current={0} // TODO: Fetch actual count
            limit={getFeatureLimit(FEATURE_KEYS.MAX_COACHES)}
            label="Coaches"
            showUpgrade={!isPaid}
            currentTier={tier}
            onUpgrade={onUpgrade}
          />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {!isPaid && (
            <Button onClick={onUpgrade} className="flex-1">
              Upgrade Plan
            </Button>
          )}

          {isPaid && (
            <Button 
              variant="outline" 
              onClick={handleManageSubscription}
              disabled={isLoadingPortal}
              className="flex-1"
            >
              {isLoadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Manage Subscription
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
