-- Add Stripe Connect fields to venues table
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) DEFAULT 10.00;

-- Create table to track venue payments/transactions
CREATE TABLE IF NOT EXISTS public.venue_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.venue_bookings(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT NOT NULL,
  stripe_transfer_id TEXT,
  amount_total INTEGER NOT NULL,
  amount_platform_fee INTEGER NOT NULL DEFAULT 0,
  amount_venue INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  customer_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.venue_payments ENABLE ROW LEVEL SECURITY;

-- Venue owners can view their own payments
CREATE POLICY "Venue owners can view their payments"
ON public.venue_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venues 
    WHERE venues.id = venue_payments.venue_id 
    AND venues.owner_id = auth.uid()
  )
);

-- Customers can view their own payments
CREATE POLICY "Customers can view their bookings payments"
ON public.venue_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_bookings 
    WHERE venue_bookings.id = venue_payments.booking_id 
    AND venue_bookings.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venue_payments_venue_id ON public.venue_payments(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_payments_booking_id ON public.venue_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_venue_payments_stripe_payment_intent ON public.venue_payments(stripe_payment_intent_id);

-- Add updated_at trigger
CREATE TRIGGER update_venue_payments_updated_at
BEFORE UPDATE ON public.venue_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();