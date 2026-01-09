import { motion } from "framer-motion";
import { Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderSummaryCardProps {
  divisionsCount: number;
  onCheckout: () => void;
  isLoading?: boolean;
  isSticky?: boolean;
}

const TOURNAMENT_LICENSE_PRICE = 29;
const ADDITIONAL_DIVISION_PRICE = 9;
const INCLUDED_DIVISIONS = 3;

export function OrderSummaryCard({
  divisionsCount,
  onCheckout,
  isLoading = false,
  isSticky = false,
}: OrderSummaryCardProps) {
  const extraDivisions = Math.max(0, divisionsCount - INCLUDED_DIVISIONS);
  const additionalCost = extraDivisions * ADDITIONAL_DIVISION_PRICE;
  const total = TOURNAMENT_LICENSE_PRICE + additionalCost;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative group ${isSticky ? "sticky top-4" : ""}`}
    >
      {/* Subtle glow effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
      
      <div className="relative bg-card/90 backdrop-blur-md border border-primary/20 rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 bg-primary/20 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Order Summary</h3>
        </div>

        {/* Line items */}
        <div className="space-y-3 mb-5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tournament License</span>
            <span className="font-medium">${TOURNAMENT_LICENSE_PRICE}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Included divisions</span>
            <span className="text-muted-foreground">{Math.min(divisionsCount, INCLUDED_DIVISIONS)} of {INCLUDED_DIVISIONS}</span>
          </div>

          {extraDivisions > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex justify-between text-sm"
            >
              <span className="text-muted-foreground">
                Additional divisions ({extraDivisions} × ${ADDITIONAL_DIVISION_PRICE})
              </span>
              <span className="font-medium">${additionalCost}</span>
            </motion.div>
          )}

          {/* Divider with gradient */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-4" />

          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Total</span>
            <motion.span 
              key={total}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="font-bold text-2xl text-primary"
            >
              ${total}
            </motion.span>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={onCheckout}
          disabled={isLoading || divisionsCount === 0}
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(169,207,70,0.3)] hover:shadow-[0_0_30px_rgba(169,207,70,0.4)] disabled:shadow-none disabled:opacity-50"
          size="lg"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Pay & Unlock Tournament
            </span>
          )}
        </Button>

        {divisionsCount === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-3">
            Please add at least one division
          </p>
        )}
      </div>
    </motion.div>
  );
}
