import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
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
      className={`bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 ${
        isSticky ? "sticky top-4" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Order Summary</h3>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tournament License</span>
          <span className="font-medium">${TOURNAMENT_LICENSE_PRICE}</span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Included divisions</span>
          <span className="text-muted-foreground">{Math.min(divisionsCount, INCLUDED_DIVISIONS)} of {INCLUDED_DIVISIONS}</span>
        </div>

        {extraDivisions > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Additional divisions ({extraDivisions} × ${ADDITIONAL_DIVISION_PRICE})
            </span>
            <span className="font-medium">${additionalCost}</span>
          </div>
        )}

        <div className="border-t border-border/50 pt-3 mt-3">
          <div className="flex justify-between">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-xl text-primary">${total}</span>
          </div>
        </div>
      </div>

      <Button
        onClick={onCheckout}
        disabled={isLoading || divisionsCount === 0}
        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        size="lg"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              ⏳
            </motion.span>
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
    </motion.div>
  );
}
