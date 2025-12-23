import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StripeConnectStatus {
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarding_complete: boolean;
  requirements?: {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
  };
}

export function useStripeConnect(venueId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const { toast } = useToast();

  const checkStatus = async () => {
    if (!venueId) return null;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-status", {
        body: { venue_id: venueId },
      });

      if (error) throw error;
      setStatus(data);
      return data;
    } catch (error) {
      console.error("Error checking Stripe status:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startOnboarding = async (returnUrl?: string, refreshUrl?: string) => {
    if (!venueId) {
      toast({
        title: "Error",
        description: "Venue ID is required",
        variant: "destructive",
      });
      return null;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { 
          venue_id: venueId,
          return_url: returnUrl,
          refresh_url: refreshUrl,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
      return data;
    } catch (error) {
      console.error("Error starting onboarding:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start onboarding",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createCheckout = async (params: {
    amount: number;
    bookingId?: string;
    description?: string;
    customerEmail?: string;
    customerName?: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, string>;
  }) => {
    if (!venueId) {
      throw new Error("Venue ID is required");
    }

    const { data, error } = await supabase.functions.invoke("create-venue-checkout", {
      body: {
        venue_id: venueId,
        booking_id: params.bookingId,
        amount: params.amount,
        description: params.description,
        customer_email: params.customerEmail,
        customer_name: params.customerName,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
      },
    });

    if (error) throw error;
    return data;
  };

  return {
    loading,
    status,
    checkStatus,
    startOnboarding,
    createCheckout,
  };
}
