import { motion } from "framer-motion";
import { Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderSummaryCard } from "./OrderSummaryCard";

interface LockedTournamentBannerProps {
  tournamentName: string;
  divisionsCount: number;
  paymentStatus: "draft" | "pending" | "failed";
  onContinuePayment: () => void;
  isLoading?: boolean;
}

export function LockedTournamentBanner({
  tournamentName,
  divisionsCount,
  paymentStatus,
  onContinuePayment,
  isLoading = false,
}: LockedTournamentBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center mb-6">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="h-8 w-8 text-muted-foreground" />
        </div>

        <h2 className="text-2xl font-bold mb-2">Tournament Locked</h2>
        <p className="text-muted-foreground mb-6">
          <span className="font-medium text-foreground">{tournamentName}</span> is currently
          locked until payment is completed.
        </p>

        {paymentStatus === "failed" && (
          <div className="flex items-center justify-center gap-2 text-destructive mb-6">
            <AlertCircle className="h-5 w-5" />
            <span>Previous payment attempt failed. Please try again.</span>
          </div>
        )}

        {paymentStatus === "pending" && (
          <div className="flex items-center justify-center gap-2 text-amber-500 mb-6">
            <AlertCircle className="h-5 w-5" />
            <span>Payment is pending. If you completed checkout, please wait a moment.</span>
          </div>
        )}
      </div>

      <OrderSummaryCard
        divisionsCount={divisionsCount}
        onCheckout={onContinuePayment}
        isLoading={isLoading}
      />
    </motion.div>
  );
}
