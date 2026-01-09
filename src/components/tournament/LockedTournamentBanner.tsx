import { motion } from "framer-motion";
import { Lock, AlertCircle, Clock } from "lucide-react";
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
      <div className="relative group mb-6">
        {/* Subtle glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-muted/50 to-muted/30 rounded-2xl blur opacity-50" />
        
        <div className="relative bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 text-center">
          {/* Lock icon with pulse */}
          <motion.div 
            className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-6 relative"
            animate={{ 
              boxShadow: [
                "0 0 0 0 rgba(169, 207, 70, 0)",
                "0 0 0 10px rgba(169, 207, 70, 0.1)",
                "0 0 0 0 rgba(169, 207, 70, 0)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Lock className="h-10 w-10 text-muted-foreground" />
          </motion.div>

          <h2 className="text-2xl font-bold mb-3">Tournament Locked</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            <span className="font-medium text-foreground">{tournamentName}</span> is currently
            locked until payment is completed.
          </p>

          {paymentStatus === "failed" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-6 max-w-md mx-auto"
            >
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">Previous payment attempt failed. Please try again.</span>
            </motion.div>
          )}

          {paymentStatus === "pending" && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 max-w-md mx-auto"
            >
              <Clock className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">Payment is pending. If you completed checkout, please wait a moment.</span>
            </motion.div>
          )}
        </div>
      </div>

      <OrderSummaryCard
        divisionsCount={divisionsCount}
        onCheckout={onContinuePayment}
        isLoading={isLoading}
      />
    </motion.div>
  );
}
