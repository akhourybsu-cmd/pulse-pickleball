import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStripeConnect } from "@/hooks/useStripeConnect";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle2, AlertCircle, Loader2, ExternalLink, Percent } from "lucide-react";

interface StripeConnectCardProps {
  venueId: string;
  currentPlatformFee?: number;
}

export function StripeConnectCard({ venueId, currentPlatformFee = 10 }: StripeConnectCardProps) {
  const { loading, status, checkStatus, startOnboarding } = useStripeConnect(venueId);
  const [platformFee, setPlatformFee] = useState(currentPlatformFee);
  const [savingFee, setSavingFee] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkStatus();
  }, [venueId]);

  useEffect(() => {
    setPlatformFee(currentPlatformFee);
  }, [currentPlatformFee]);

  const handleSavePlatformFee = async () => {
    setSavingFee(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({ platform_fee_percent: platformFee })
        .eq("id", venueId);

      if (error) throw error;

      toast({
        title: "Platform fee updated",
        description: `Platform fee set to ${platformFee}%`,
      });
    } catch (error) {
      console.error("Error saving platform fee:", error);
      toast({
        title: "Error",
        description: "Failed to update platform fee",
        variant: "destructive",
      });
    } finally {
      setSavingFee(false);
    }
  };

  const getStatusBadge = () => {
    if (!status?.connected) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    if (!status.onboarding_complete) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Onboarding Incomplete</Badge>;
    }
    if (status.charges_enabled && status.payouts_enabled) {
      return <Badge className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Limited</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <CardTitle>Payment Processing</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>
          Connect your Stripe account to accept payments directly from customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : status?.connected && status?.onboarding_complete ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Your Stripe account is connected and ready to accept payments</span>
            </div>

            <div className="grid gap-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Charges Enabled</span>
                {status.charges_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Payouts Enabled</span>
                {status.payouts_enabled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="platform-fee" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Platform Fee
              </Label>
              <div className="flex gap-2">
                <Input
                  id="platform-fee"
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <span className="flex items-center text-sm text-muted-foreground">%</span>
                <Button
                  size="sm"
                  onClick={handleSavePlatformFee}
                  disabled={savingFee || platformFee === currentPlatformFee}
                >
                  {savingFee ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This percentage will be deducted from each booking payment as a platform fee
              </p>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => startOnboarding()}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Stripe Account
            </Button>
          </div>
        ) : status?.connected && !status?.onboarding_complete ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle className="h-4 w-4" />
              <span>Your account setup is incomplete</span>
            </div>
            
            {status.requirements?.currently_due && status.requirements.currently_due.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm font-medium text-yellow-800">Requirements needed:</p>
                <ul className="mt-1 list-inside list-disc text-xs text-yellow-700">
                  {status.requirements.currently_due.slice(0, 3).map((req, i) => (
                    <li key={i}>{req.replace(/_/g, " ")}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={() => startOnboarding()} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Setup
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 font-medium">Accept Payments Online</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your Stripe account to start accepting credit card payments for bookings
              </p>
            </div>

            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Get paid directly to your bank account
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Accept all major credit cards
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Automatic payment confirmations
              </li>
            </ul>

            <Button onClick={() => startOnboarding()} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect Stripe Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
