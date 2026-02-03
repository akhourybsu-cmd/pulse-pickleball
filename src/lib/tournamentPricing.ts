import { isPast, isBefore } from "date-fns";

interface Division {
  registration_fee?: number | null;
  early_bird_fee?: number | null;
  early_bird_deadline?: string | null;
}

export interface PricingInfo {
  currentPrice: number;
  regularPrice: number;
  isEarlyBird: boolean;
  savings: number;
  earlyBirdDeadline: Date | null;
  daysUntilDeadline: number | null;
}

/**
 * Calculate the current pricing for a division
 */
export function getDivisionPricing(
  division: Division,
  eventFee?: number | null
): PricingInfo {
  const regularPrice = division.registration_fee ?? eventFee ?? 0;
  
  // Check for early bird pricing
  if (division.early_bird_fee && division.early_bird_deadline) {
    const deadline = new Date(division.early_bird_deadline);
    
    if (!isPast(deadline)) {
      const now = new Date();
      const daysUntil = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      return {
        currentPrice: division.early_bird_fee,
        regularPrice,
        isEarlyBird: true,
        savings: regularPrice - division.early_bird_fee,
        earlyBirdDeadline: deadline,
        daysUntilDeadline: daysUntil,
      };
    }
  }

  return {
    currentPrice: regularPrice,
    regularPrice,
    isEarlyBird: false,
    savings: 0,
    earlyBirdDeadline: null,
    daysUntilDeadline: null,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  if (amount === 0) return "Free";
  return `$${amount.toFixed(2)}`;
}

/**
 * Calculate total price for a registration
 */
export function calculateRegistrationTotal(
  divisionPricing: PricingInfo,
  additionalFees?: { name: string; amount: number }[]
): { total: number; breakdown: { name: string; amount: number }[] } {
  const breakdown = [
    { name: "Registration Fee", amount: divisionPricing.currentPrice },
  ];

  if (additionalFees) {
    breakdown.push(...additionalFees);
  }

  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return { total, breakdown };
}
